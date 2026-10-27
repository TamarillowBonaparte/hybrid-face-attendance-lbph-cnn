"""
FAISS Gallery Module (Revisi)
=========================
Enhanced gallery system with:
1. FAISS Index for scalable search
2. Top-3 search for robust matching
3. Incremental Template Update (similarity ≥ 0.98)
4. Gallery Quality - menyimpan metadata kualitas template

Revisi:
- Top-3 (bukan Top-5)
- Gallery Quality: simpan quality score, tanggal, jumlah registrasi
- Incremental update: similarity ≥ 0.98

Author: Skripsi 2026
"""

import numpy as np
import pickle
import json
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime

from config import (
    FAISS_CONFIG, TEMPLATE_UPDATE_CONFIG, GALLERY_QUALITY_CONFIG,
    DATABASE_CONFIG, CNN_DIM, get_quality_weights, FUSION_CONFIG,
    THRESHOLD_CONFIG
)

log = logging.getLogger(__name__)


@dataclass
class IdentityMetadata:
    """
    Metadata untuk identitas terdaftar.

    Revisi: Tambahkan Gallery Quality info
    - quality_score: Quality score saat enrollment
    - enrollment_date: Tanggal registrasi
    - num_registrations: Jumlah foto yang digunakan
    """
    nim: str
    name: Optional[str] = None

    # Gallery Quality Info (Revisi)
    enrollment_date: str = ""
    quality_score: float = 0.0
    num_registrations: int = 0

    # Recognition tracking
    num_recognitions: int = 0
    last_seen: Optional[str] = None
    avg_similarity: float = 0.0
    template_age: int = 0  # Number of updates


@dataclass
class RecognitionResult:
    """Result of a recognition query."""
    nim: Optional[str]
    similarity: float
    lbph_similarity: float = 0.0  # Revisi: tambahkan breakdown
    cnn_similarity: float = 0.0
    top_k_results: List[Dict] = field(default_factory=list)
    is_recognized: bool = False
    template_updated: bool = False
    message: str = ""


class FAISSGallery:
    """
    FAISS-based gallery for scalable face recognition.

    Features:
    - FAISS Index (Inner Product for cosine similarity)
    - Top-3 search (Revisi: dari Top-5)
    - Incremental template update (similarity ≥ 0.98)
    - Gallery Quality metadata
    - Parallel LBPH gallery untuk score-level fusion
    """

    def __init__(self, embedding_dim: int = None):
        self.embedding_dim = embedding_dim or CNN_DIM
        self.config = FAISS_CONFIG
        self.update_config = TEMPLATE_UPDATE_CONFIG
        self.gallery_quality_config = GALLERY_QUALITY_CONFIG

        # FAISS index
        self.index = None
        self._use_faiss = False

        # CNN Gallery (FAISS) — primary centroid
        self.identities: Dict[str, np.ndarray] = {}
        self.identity_list: List[str] = []

        # CNN Multi-Template Gallery — semua embedding individual per orang
        # Digunakan untuk max-similarity matching (lebih akurat dari centroid saja)
        self.cnn_templates: Dict[str, List[np.ndarray]] = {}

        # LBPH Gallery (Revisi: untuk Score-Level Fusion)
        self.lbph_gallery: Dict[str, List[np.ndarray]] = {}

        # Metadata
        self.metadata: Dict[str, IdentityMetadata] = {}

        # Recognition tracking
        self.recognition_counts: Dict[str, int] = {}
        self.pending_updates: Dict[str, List[np.ndarray]] = {}

        # Threshold
        # Keep one source of truth.  The old hard-coded 0.70 conflicted with
        # ThresholdCalibrator/config.py (0.58), so the active threshold could
        # depend on which gallery file was loaded first.
        self.threshold = float(THRESHOLD_CONFIG['initial_threshold'])

        self._init_faiss()
        self._load()

    def _init_faiss(self):
        """Initialize FAISS index."""
        try:
            import faiss
            self._faiss = faiss
            self._use_faiss = True
            log.info("[Gallery] FAISS available")
        except ImportError:
            log.warning("[Gallery] FAISS not installed. Using numpy fallback.")
            self._faiss = None
            self._use_faiss = False

    def _create_index(self):
        """Create FAISS index."""
        if not self._use_faiss:
            return None

        return self._faiss.IndexFlatIP(self.embedding_dim)

    def _load(self):
        """Load gallery from disk."""
        metadata_path = DATABASE_CONFIG['metadata']
        if metadata_path.exists():
            try:
                with open(metadata_path, 'rb') as f:
                    data = pickle.load(f)
                    self.identities = data.get('identities', {})
                    self.identity_list = data.get('identity_list', [])
                    self.lbph_gallery = data.get('lbph_gallery', {})
                    self.cnn_templates = data.get('cnn_templates', {})

                    # Convert metadata
                    metadata_dict = data.get('metadata', {})
                    self.metadata = {}
                    for k, v in metadata_dict.items():
                        if isinstance(v, dict):
                            self.metadata[k] = IdentityMetadata(**v)
                        else:
                            self.metadata[k] = v

                self._build_index()
                log.info(f"[Gallery] Loaded {len(self.identities)} identities")
            except Exception as e:
                log.warning(f"[Gallery] Load failed: {e}")

        # Load calibration threshold
        calib_path = DATABASE_CONFIG['calibration']
        if calib_path.exists():
            try:
                with open(calib_path, 'r') as f:
                    calib_data = json.load(f)
                    self.threshold = calib_data.get('optimal_threshold', self.threshold)
                log.info(f"[Gallery] Loaded threshold: {self.threshold:.4f}")
            except Exception as e:
                log.warning(f"[Gallery] Calibration load failed: {e}")

    def _save(self):
        """Save gallery to disk."""
        metadata_path = DATABASE_CONFIG['metadata']
        metadata_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            'identities': self.identities,
            'identity_list': self.identity_list,
            'lbph_gallery': self.lbph_gallery,
            'cnn_templates': self.cnn_templates,
            'metadata': {k: asdict(v) if isinstance(v, IdentityMetadata) else v
                         for k, v in self.metadata.items()}
        }

        with open(metadata_path, 'wb') as f:
            pickle.dump(data, f)

        log.info(f"[Gallery] Saved {len(self.identities)} identities")

    def _build_index(self):
        """Build or rebuild FAISS index."""
        if not self._use_faiss or len(self.identities) == 0:
            return

        self.index = self._create_index()

        embeddings = []
        for nim in self.identity_list:
            if nim in self.identities:
                embeddings.append(self.identities[nim])

        if embeddings:
            embeddings_array = np.array(embeddings).astype('float32')
            self.index.add(embeddings_array)
            log.info(f"[Gallery] Index built with {len(embeddings)} vectors")

    def add_identity(
        self,
        nim: str,
        cnn_embedding: np.ndarray,
        lbph_embedding: Optional[np.ndarray] = None,
        metadata: Optional[Dict] = None,
        cnn_templates: Optional[List[np.ndarray]] = None,
        lbph_templates: Optional[List[np.ndarray]] = None  # Fix 4: terima semua templates
    ) -> bool:
        """
        Add a new identity to the gallery.

        Args:
            nim: Unique identifier
            cnn_embedding: CNN embedding vector (512-D) — Quality-Weighted Centroid
            lbph_embedding: LBPH embedding vector (640-D) — fallback single template
            metadata: Optional metadata
            cnn_templates: List of individual CNN embeddings per foto
                           (untuk multi-template max-similarity matching)
            lbph_templates: List of individual LBPH embeddings per foto
                            (Fix 4: simpan semua — lebih robust untuk variasi pose/cahaya)
        """
        if cnn_embedding is None:
            log.error(f"[Gallery] No CNN embedding provided for {nim}")
            return False

        # Normalize CNN embedding
        norm = np.linalg.norm(cnn_embedding)
        if norm > 1e-7:
            cnn_embedding = cnn_embedding / norm
        else:
            log.error(f"[Gallery] Invalid CNN embedding for {nim}")
            return False

        # Store CNN centroid (primary, untuk FAISS search)
        self.identities[nim] = cnn_embedding
        if nim not in self.identity_list:
            self.identity_list.append(nim)

        # Store CNN multi-templates (untuk max-similarity matching)
        if cnn_templates is not None and len(cnn_templates) > 0:
            normalized_templates = []
            for tmpl in cnn_templates:
                t_norm = np.linalg.norm(tmpl)
                if t_norm > 1e-7:
                    normalized_templates.append(tmpl / t_norm)
            self.cnn_templates[nim] = normalized_templates
            log.info(f"[Gallery] Stored {len(normalized_templates)} CNN templates for {nim}")

        # Store LBPH — Fix 4: simpan SEMUA templates individual.
        # Jika lbph_templates tersedia, gunakan itu (lebih banyak coverage).
        # Fallback: gunakan lbph_embedding tunggal (kompatibilitas backward).
        if lbph_templates is not None and len(lbph_templates) > 0:
            # Simpan semua template individual dengan L1-norm yang konsisten
            self.lbph_gallery[nim] = []
            for tmpl in lbph_templates:
                tmpl_sum = tmpl.sum()
                if tmpl_sum > 1e-7:
                    self.lbph_gallery[nim].append(tmpl / tmpl_sum)
                else:
                    self.lbph_gallery[nim].append(tmpl)
            log.info(f"[Gallery] Stored {len(self.lbph_gallery[nim])} LBPH templates for {nim}")
        elif lbph_embedding is not None:
            # Backward compat: simpan 1 template saja
            self.lbph_gallery[nim] = []
            lbph_sum = lbph_embedding.sum()
            if lbph_sum > 1e-7:
                lbph_l1 = lbph_embedding / lbph_sum
            else:
                lbph_l1 = lbph_embedding
            self.lbph_gallery[nim].append(lbph_l1)
            log.info(f"[Gallery] Stored 1 LBPH template (fallback) for {nim}")

        # Gallery Quality metadata
        quality_score = metadata.get('quality_score', 0.0) if metadata else 0.0

        self.metadata[nim] = IdentityMetadata(
            nim=nim,
            name=metadata.get('name') if metadata else None,
            enrollment_date=datetime.now().isoformat(),
            quality_score=quality_score,
            num_registrations=metadata.get('num_registrations', 1) if metadata else 1,
            num_recognitions=0,
            last_seen=None,
            avg_similarity=0.0,
            template_age=0
        )

        self.recognition_counts[nim] = 0
        self.pending_updates[nim] = []

        self._build_index()
        self._save()

        n_templates = len(self.cnn_templates.get(nim, []))
        log.info(f"[Gallery] Added identity: {nim} (quality: {quality_score:.2f}, templates: {n_templates})")
        return True

    def search_top_k(
        self,
        query_embedding: np.ndarray,
        k: int = None
    ) -> List[Tuple[str, float]]:
        """
        Search for top-K matches (CNN only).

        Args:
            query_embedding: Query embedding
            k: Number of results (default: Top-3)

        Returns:
            List of (nim, similarity) tuples
        """
        k = k or self.config.get('top_k', 3)

        if len(self.identities) == 0:
            return []

        query_vector = np.asarray(query_embedding, dtype=np.float32).reshape(-1)
        query_norm = np.linalg.norm(query_vector)
        if query_norm > 1e-7:
            query_vector = query_vector / query_norm

        # For the normal-sized gallery, search against every stored template
        # instead of only the centroid in FAISS.  A centroid can be far from a
        # valid query when enrollment contains different poses/lighting; in
        # that case the correct identity used to be discarded before the
        # multi-template max-similarity rule was reached.
        # This is still zero-shot recognition: no classifier or retraining is
        # introduced, only a more faithful gallery search.
        exact_limit = self.config.get('exact_threshold', 1000)
        has_templates = any(self.cnn_templates.get(nim) for nim in self.identity_list)
        if has_templates and len(self.identities) <= exact_limit:
            results = []
            for nim in self.identity_list:
                templates = self.cnn_templates.get(nim) or []
                candidates = templates if templates else [self.identities.get(nim)]
                similarities = []
                for template in candidates:
                    if template is None:
                        continue
                    template = np.asarray(template, dtype=np.float32).reshape(-1)
                    template_norm = np.linalg.norm(template)
                    if template_norm > 1e-7:
                        template = template / template_norm
                    similarities.append(float(np.dot(query_vector, template)))
                if similarities:
                    results.append((nim, max(similarities)))
            results.sort(key=lambda item: item[1], reverse=True)
            return results[:min(k, len(results))]

        query = query_vector.reshape(1, -1).astype('float32')

        if self._use_faiss and self.index is not None:
            if self.index.ntotal == 0:
                return []

            distances, indices = self.index.search(query, min(k, self.index.ntotal))

            results = []
            for dist, idx in zip(distances[0], indices[0]):
                if idx >= 0 and idx < len(self.identity_list):
                    nim = self.identity_list[idx]
                    similarity = float(dist)
                    results.append((nim, similarity))

            return results
        else:
            # Numpy fallback
            results = []
            for nim, emb in self.identities.items():
                similarity = float(np.dot(query_embedding, emb))
                results.append((nim, similarity))

            results.sort(key=lambda x: x[1], reverse=True)
            return results[:k]

    def match_lbph(
        self,
        query_lbph: np.ndarray
    ) -> List[Tuple[str, float]]:
        """
        Match query LBPH against LBPH gallery using Histogram Intersection.

        Revisi Akurasi v3: Histogram Intersection instead of cosine similarity.
        - Histogram Intersection: Σ min(H1[i], H2[i])
        - Range: [0, 1], higher is better
        - More appropriate for histogram-based features like LBPH
        - L1-norm normalization (sum = 1) required for proper comparison

        Returns:
            List of (nim, similarity) tuples
        """
        if len(self.lbph_gallery) == 0:
            return []

        # L1-norm normalization (sum = 1) for histogram intersection
        query_sum = query_lbph.sum()
        if query_sum > 1e-7:
            query_norm = query_lbph / query_sum
        else:
            query_norm = query_lbph

        results = []
        for nim, templates in self.lbph_gallery.items():
            # Histogram Intersection for each template
            similarities = []
            for template in templates:
                # Ensure template is L1-normalized
                template_sum = template.sum()
                if template_sum > 1e-7:
                    template_norm = template / template_sum
                else:
                    template_norm = template

                # Histogram Intersection: Σ min(H1[i], H2[i])
                intersection = np.sum(np.minimum(query_norm, template_norm))
                similarities.append(intersection)

            # Max similarity across templates (konsisten dengan CNN multi-template)
            # Average menarik skor turun karena banyak template augmented yang
            # tidak mirip query real → skor genuine turun 10-20%.
            max_sim = float(np.max(similarities))
            results.append((nim, max_sim))

        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def recognize(
        self,
        query_cnn: np.ndarray,
        query_lbph: np.ndarray = None,
        quality_score: float = 0.5,
        threshold: float = None,
        update_template: bool = True
    ) -> RecognitionResult:
        """
        Recognize using Score-Level Fusion (Revisi).

        Args:
            query_cnn: Query CNN embedding
            query_lbph: Query LBPH embedding (optional)
            quality_score: Face quality score
            threshold: Similarity threshold
            update_template: Whether to update template

        Returns:
            RecognitionResult dengan breakdown LBPH dan CNN
        """
        threshold = self.threshold if threshold is None else threshold

        if len(self.identities) == 0:
            return RecognitionResult(nim=None, similarity=0.0)

        # CNN search
        cnn_results = self.search_top_k(query_cnn, k=self.config.get('top_k', 3))
        cnn_dict = {nim: sim for nim, sim in cnn_results}

        # LBPH match (Revisi)
        lbph_sim = 0.0
        lbph_results = []
        if query_lbph is not None and len(self.lbph_gallery) > 0:
            lbph_results = self.match_lbph(query_lbph)
            lbph_dict = {nim: sim for nim, sim in lbph_results}
        else:
            lbph_dict = {}

        # Score-Level Fusion
        best_nim = None
        best_fused = 0.0
        best_cnn = 0.0

        top_k = self.config.get('top_k', 3)
        fused_results = []

        # Candidates: union of CNN and LBPH results
        all_nims = set(list(cnn_dict.keys())[:top_k])
        if lbph_dict:
            all_nims.update(list(lbph_dict.keys())[:top_k])

        for nim in all_nims:
            # Multi-template CNN matching: gunakan max-similarity rule
            # jika multi-template tersedia (lebih akurat dari centroid saja)
            if nim in self.cnn_templates and len(self.cnn_templates[nim]) > 0:
                template_sims = [float(np.dot(query_cnn, t)) for t in self.cnn_templates[nim]]
                cnn_s = max(template_sims)  # Max-similarity rule
            elif nim in cnn_dict:
                cnn_s = cnn_dict[nim]
            elif nim in self.identities:
                cnn_s = float(np.dot(query_cnn, self.identities[nim]))
            else:
                cnn_s = 0.0
            lbph_s = lbph_dict.get(nim, 0.0)

            # ─────────────────────────────────────────────────────────────────
            # SIGMOID-NORMALIZED SCORE FUSION (Revisi v4 — Final)
            #
            # Masalah: CNN cosine sim (genuine 0.55-0.80) dan LBPH histogram
            # intersection (genuine 0.75-0.90) punya SKALA BERBEDA. Weighted
            # average linear menghasilkan skor ~0.75-0.85 yang masih di bawah
            # 90% karena kedua skor ada di range menengah.
            #
            # Solusi: SIGMOID normalization.
            # Sigmoid memetakan skor raw ke [0,1] secara non-linear:
            #   - Skor jauh di atas center → mendekati 1.0
            #   - Skor jauh di bawah center → mendekati 0.0
            #   - Center = batas keputusan antara genuine dan impostor
            #
            # Ini memodeli probabilitas bahwa skor tersebut berasal dari
            # genuine match, bukan impostor.
            #
            # CNN:  center=0.45 (genuine≥0.55, impostor≤0.35)
            # LBPH: center=0.65 (genuine≥0.70, impostor≤0.60)
            # k=12: steepness yang memberi separasi baik
            # ─────────────────────────────────────────────────────────────────
            if query_lbph is not None and lbph_s > 0:
                import math

                # Sigmoid parameters
                k = 12.0  # steepness
                cnn_center = 0.45   # midpoint antara genuine dan impostor CNN
                lbph_center = 0.65  # midpoint antara genuine dan impostor LBPH

                # Sigmoid normalization: 1 / (1 + exp(-k * (x - center)))
                cnn_norm = 1.0 / (1.0 + math.exp(-k * (cnn_s - cnn_center)))
                lbph_norm = 1.0 / (1.0 + math.exp(-k * (lbph_s - lbph_center)))

                # Adaptive weight berdasarkan CNN confidence
                if cnn_norm >= 0.75:     # CNN confident
                    w_cnn = 0.60
                elif cnn_norm >= 0.50:   # CNN moderate
                    w_cnn = 0.50
                else:                     # CNN low → trust LBPH more
                    w_cnn = 0.40
                w_lbph = 1.0 - w_cnn

                # Fused normalized score
                fused_norm = w_cnn * cnn_norm + w_lbph * lbph_norm

                # Rescale ke range [0.40, 1.00] agar threshold 0.58 tetap berlaku
                fused = 0.40 + fused_norm * 0.60
            else:
                # No LBPH, use CNN only
                fused = cnn_s
                w_cnn = 1.0
                w_lbph = 0.0

            fused_results.append({
                'nim': nim,
                'lbph_sim': lbph_s,
                'cnn_sim': cnn_s,
                'fused': fused,
                'weights': {'cnn': w_cnn, 'lbph': w_lbph}
            })

        # Sort by fused score
        fused_results.sort(key=lambda x: x['fused'], reverse=True)

        if fused_results:
            best = fused_results[0]
            best_nim = best['nim']
            best_fused = best['fused']
            best_cnn = best['cnn_sim']
            lbph_sim = best['lbph_sim']

        is_recognized = best_fused >= threshold

        result = RecognitionResult(
            nim=best_nim if is_recognized else None,
            similarity=best_fused,
            lbph_similarity=lbph_sim,
            cnn_similarity=best_cnn,
            top_k_results=fused_results[:top_k],
            is_recognized=is_recognized,
            template_updated=False
        )

        # Incremental template update (Revisi: 0.98)
        if update_template and is_recognized and self.update_config.get('enabled', True):
            if self._maybe_update_template(best_nim, query_cnn, best_cnn):
                result.template_updated = True

        return result

    def _maybe_update_template(
        self,
        nim: str,
        new_embedding: np.ndarray,
        similarity: float
    ) -> bool:
        """
        Conditionally update a face template.

        Revisi: similarity ≥ 0.98 (lebih konservatif dari 0.90)
        """
        cfg = self.update_config
        if not cfg.get('enabled', True):
            return False

        # Revisi: lebih konservatif
        if similarity < cfg.get('similarity_threshold', 0.98):
            return False

        if nim not in self.pending_updates:
            self.pending_updates[nim] = []
        self.pending_updates[nim].append(new_embedding)
        self.recognition_counts[nim] = self.recognition_counts.get(nim, 0) + 1

        # Check if should apply
        batch_size = 5
        min_occurrences = 10

        if nim in self.pending_updates:
            pending = self.pending_updates[nim]
            meta = self.metadata.get(nim)

            if len(pending) >= batch_size and meta and meta.num_recognitions >= min_occurrences:
                if meta.template_age < 100:
                    self._apply_template_update(nim, pending)
                    self.pending_updates[nim] = []
                    return True

        return False

    def _apply_template_update(
        self,
        nim: str,
        new_embeddings: List[np.ndarray]
    ):
        """Apply template update using EMA."""
        alpha = self.update_config.get('ema_alpha', 0.2)

        if nim not in self.identities:
            return

        old_template = self.identities[nim]
        new_mean = np.mean(new_embeddings, axis=0)
        new_mean = new_mean / (np.linalg.norm(new_mean) + 1e-7)

        # EMA
        updated = alpha * new_mean + (1 - alpha) * old_template
        updated = updated / (np.linalg.norm(updated) + 1e-7)

        self.identities[nim] = updated

        if nim in self.metadata:
            self.metadata[nim].template_age += 1
            self.metadata[nim].num_recognitions += len(new_embeddings)

        self._build_index()
        self._save()

        log.info(f"[Gallery] Template updated for {nim}")

    def verify_identity(
        self,
        nim: str,
        query_cnn: np.ndarray,
        query_lbph: np.ndarray = None,
        quality_score: float = 0.5,
        threshold: float = None
    ) -> Tuple[bool, float]:
        """Verify if query matches specific identity."""
        threshold = self.threshold if threshold is None else threshold

        # Case-insensitive NIM lookup: coba exact match → uppercase → search
        resolved_nim = None
        if nim in self.identities:
            resolved_nim = nim
        else:
            nim_upper = nim.strip().upper()
            if nim_upper in self.identities:
                resolved_nim = nim_upper
            else:
                # Fallback: cari case-insensitive di semua keys
                for key in self.identities:
                    if key.upper() == nim_upper:
                        resolved_nim = key
                        break

        if resolved_nim is None:
            log.warning(f"[Gallery] verify_identity: NIM '{nim}' not found in gallery "
                        f"(gallery keys: {list(self.identities.keys())[:5]}...)")
            return False, 0.0

        nim = resolved_nim  # Gunakan NIM yang resolved

        # Multi-template CNN matching (max-similarity rule)
        if nim in self.cnn_templates and len(self.cnn_templates[nim]) > 0:
            template_sims = [float(np.dot(query_cnn, t)) for t in self.cnn_templates[nim]]
            cnn_sim = max(template_sims)
        else:
            template = self.identities[nim]
            cnn_sim = float(np.dot(query_cnn, template))

        lbph_sim = 0.0
        if query_lbph is not None and nim in self.lbph_gallery:
            # L1-norm normalization for histogram intersection
            query_sum = query_lbph.sum()
            if query_sum > 1e-7:
                query_lbph_norm = query_lbph / query_sum
            else:
                query_lbph_norm = query_lbph

            lbph_sims = []
            for template in self.lbph_gallery[nim]:
                # Ensure template is L1-normalized
                template_sum = template.sum()
                if template_sum > 1e-7:
                    template_norm = template / template_sum
                else:
                    template_norm = template
                # Histogram Intersection
                intersection = np.sum(np.minimum(query_lbph_norm, template_norm))
                lbph_sims.append(intersection)
            lbph_sim = float(np.max(lbph_sims))

        # Sigmoid-normalized fusion (konsisten dengan recognize())
        if query_lbph is not None and lbph_sim > 0:
            import math

            k = 12.0
            cnn_center = 0.45
            lbph_center = 0.65

            cnn_norm = 1.0 / (1.0 + math.exp(-k * (cnn_sim - cnn_center)))
            lbph_norm = 1.0 / (1.0 + math.exp(-k * (lbph_sim - lbph_center)))

            if cnn_norm >= 0.75:
                w_cnn = 0.60
            elif cnn_norm >= 0.50:
                w_cnn = 0.50
            else:
                w_cnn = 0.40
            w_lbph = 1.0 - w_cnn

            fused_norm = w_cnn * cnn_norm + w_lbph * lbph_norm
            final_sim = 0.40 + fused_norm * 0.60
        else:
            final_sim = cnn_sim

        return final_sim >= threshold, final_sim

    def get_identity_info(self, nim: str) -> Optional[IdentityMetadata]:
        """Get metadata for an identity (Revisi: include Gallery Quality)."""
        return self.metadata.get(nim)

    def get_gallery_stats(self) -> Dict:
        """Get gallery statistics including quality info (Revisi)."""
        if not self.metadata:
            return {'count': 0}

        qualities = [m.quality_score for m in self.metadata.values() if m.quality_score > 0]
        return {
            'count': len(self.identities),
            'avg_quality': np.mean(qualities) if qualities else 0.0,
            'min_quality': min(qualities) if qualities else 0.0,
            'max_quality': max(qualities) if qualities else 0.0,
        }

    def remove_identity(self, nim: str) -> bool:
        """Remove identity from gallery."""
        if nim in self.identities:
            del self.identities[nim]
        if nim in self.identity_list:
            self.identity_list.remove(nim)
        if nim in self.cnn_templates:
            del self.cnn_templates[nim]
        if nim in self.lbph_gallery:
            del self.lbph_gallery[nim]
        if nim in self.metadata:
            del self.metadata[nim]
        if nim in self.recognition_counts:
            del self.recognition_counts[nim]
        if nim in self.pending_updates:
            del self.pending_updates[nim]

        self._build_index()
        self._save()
        log.info(f"[Gallery] Removed identity: {nim}")
        return True

    def set_threshold(self, threshold: float):
        """Set recognition threshold."""
        self.threshold = threshold

    def get_identity_count(self) -> int:
        """Get number of identities."""
        return len(self.identities)

    def list_identities(self) -> List[str]:
        """List all identity NIMs."""
        return self.identity_list.copy()

    def clear(self):
        """Clear all gallery data."""
        self.identities = {}
        self.identity_list = []
        self.cnn_templates = {}
        self.lbph_gallery = {}
        self.metadata = {}
        self.recognition_counts = {}
        self.pending_updates = {}
        self.index = None
        self._build_index()
        self._save()
        log.info("[Gallery] Cleared")


# Test function
if __name__ == "__main__":
    log.info("Testing FAISSGallery (Revisi)...")

    gallery = FAISSGallery(embedding_dim=512)

    # Test enrollment with Gallery Quality
    for i in range(5):
        nim = f"E412533{str(i).zfill(2)}"
        cnn_emb = np.random.randn(512).astype(np.float32)
        cnn_emb = cnn_emb / np.linalg.norm(cnn_emb)

        lbph_emb = np.random.randn(640).astype(np.float32)
        lbph_emb = lbph_emb / np.linalg.norm(lbph_emb)

        gallery.add_identity(nim, cnn_emb, lbph_emb, {
            'quality_score': 0.7 + i * 0.05,
            'num_registrations': 5,
            'name': f'Student {i}'
        })

    # Test recognition with Score-Level Fusion
    query_cnn = np.random.randn(512).astype(np.float32)
    query_cnn = query_cnn / np.linalg.norm(query_cnn)
    query_lbph = np.random.randn(640).astype(np.float32)
    query_lbph = query_lbph / np.linalg.norm(query_lbph)

    result = gallery.recognize(query_cnn, query_lbph, quality_score=0.85)
    log.info(f"\nRecognition:")
    log.info(f"  NIM: {result.nim}")
    log.info(f"  Final Score: {result.similarity:.3f}")
    log.info(f"  CNN Score: {result.cnn_similarity:.3f}")
    log.info(f"  LBPH Score: {result.lbph_similarity:.3f}")

    if result.top_k_results:
        log.info(f"\nTop-3:")
        for i, r in enumerate(result.top_k_results, 1):
            log.info(f"  {i}. {r['nim']}: fused={r['fused']:.3f}, cnn={r['cnn_sim']:.3f}, lbph={r['lbph_sim']:.3f}")

    # Gallery stats
    stats = gallery.get_gallery_stats()
    log.info(f"\nGallery Stats:")
    log.info(f"  Count: {stats['count']}")
    log.info(f"  Avg Quality: {stats['avg_quality']:.2f}")
