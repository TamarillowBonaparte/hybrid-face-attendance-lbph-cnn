"""
Score-Level Fusion Module (Revisi)
================================
Quality-Aware Score-Level Fusion

INI ADALAH NOVELTY UTAMA.

Arsitektur:
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCORE-LEVEL FUSION (BUKAN Feature-Level)                 │
└─────────────────────────────────────────────────────────────────────────────┘

Feature-Level Fusion (LAMA):
  LBPH ──► Feature (640-D) ──┐
                             ├─► Concat ──► Embedding
  CNN  ──► Feature (512-D) ──┘

  ❌ Perlu Dense Layer yang tidak dilatih
  ❌ Sulit dijelaskan ke penguji
  ❌ Bukan zero retraining

Score-Level Fusion (BARU):
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                       │
  │   Query Face                                                          │
  │       │                                                                │
  │       ├──► LBPH ──► Normalize ──► Query LBPH (640-D)               │
  │       │                        │                                      │
  │       │                        └──────┐                               │
  │       │                               │                               │
  │       ├──► CNN ──► Normalize ──► Query CNN (512-D)                  │
  │       │                        │                                      │
  │       │                        │                                      │
  │       │              ┌──────────┴───────────┐                         │
  │       │              │                      │                         │
  │       ▼              ▼                      ▼                         │
  │   ┌─────────────────────────────────────────────────────────────┐     │
  │   │                                                              │     │
  │   │   GALLERY MATCHING (Parallel)                               │     │
  │   │                                                              │     │
  │   │   ┌─────────────────┐        ┌─────────────────┐           │     │
  │   │   │  LBPH Gallery   │        │  CNN Gallery     │           │     │
  │   │   │  (templates)    │        │  (FAISS)        │           │     │
  │   │   └────────┬────────┘        └────────┬────────┘           │     │
  │   │            │                          │                      │     │
  │   │            │ Cosine Sim               │ Cosine Sim          │     │
  │   │            │                          │                      │     │
  │   │            ▼                          ▼                      │     │
  │   │   ┌─────────────────┐        ┌─────────────────┐           │     │
  │   │   │ LBPH Similarity │        │ CNN Similarity  │           │     │
  │   │   │    = 0.81       │        │    = 0.94       │           │     │
  │   │   └─────────────────┘        └─────────────────┘           │     │
  │   │            │                          │                      │     │
  │   │            └──────────────┬───────────┘                      │     │
  │   │                            │                                  │     │
  │   │                            ▼                                  │     │
  │   │   ┌─────────────────────────────────────────────────────┐   │     │
  │   │   │                                                       │   │     │
  │   │   │  QUALITY-AWARE WEIGHT CALCULATOR                     │   │     │
  │   │   │                                                       │   │     │
  │   │   │  Quality Score = 0.85                                 │   │     │
  │   │   │                                                       │   │     │
  │   │   │  wCNN = QualityScore = 0.85                          │   │     │
  │   │   │  wLBPH = 1 - QualityScore = 0.15                     │   │     │
  │   │   │                                                       │   │     │
  │   │   └───────────────────────┬───────────────────────────────┘   │     │
  │   │                             │                                   │     │
  │   │                             ▼                                   │     │
  │   │   ┌───────────────────────────────────────────────────────┐   │     │
  │   │   │                                                        │   │     │
  │   │   │  FINAL SCORE = wCNN × CNN_sim + wLBPH × LBPH_sim     │   │     │
  │   │   │           = 0.85 × 0.94 + 0.15 × 0.81                │   │     │
  │   │   │           = 0.799 + 0.1215                            │   │     │
  │   │   │           = 0.92                                     │   │     │
  │   │   │                                                        │   │     │
  │   │   └───────────────────────┬───────────────────────────────┘   │     │
  │   │                             │                                   │     │
  │   └─────────────────────────────┼─────────────────────────────────┘     │
  │                                 │                                      │
  │                                 ▼                                      │
  │                    ┌─────────────────────┐                            │
  │                    │   Threshold Check   │                            │
  │                    │   (ROC + EER)       │                            │
  │                    └─────────────────────┘                            │
  │                                                                         │
  └─────────────────────────────────────────────────────────────────────────┘

Keuntungan Score-Level Fusion:
1. ✓ Zero retraining (tidak ada Dense Layer)
2. ✓ Mudah dijelaskan ke penguji
3. ✓ Sering dipakai di sistem biometrik
4. ✓ Sesuai konsep hybrid system
5. ✓ Quality digunakan secara eksplisit

Author: Skripsi 2026
"""

import numpy as np
from typing import Dict, List, Tuple
import logging

from config import FUSION_CONFIG, get_quality_weights

log = logging.getLogger(__name__)


class ScoreLevelFusion:
    """
    Score-Level Fusion - Quality-Aware.

    Novelty: Quality Score menentukan bobot fusion secara langsung.

    wCNN = QualityScore
    wLBPH = 1 - QualityScore

    Contoh:
    - Quality = 0.85 (bagus) → wCNN=0.85, wLBPH=0.15 (percaya CNN lebih)
    - Quality = 0.40 (buruk) → wCNN=0.40, wLBPH=0.60 (percaya LBPH lebih karena CNN tidak reliable)
    """

    def __init__(self):
        self.config = FUSION_CONFIG

    def _l2_normalize(self, vector: np.ndarray) -> np.ndarray:
        """L2 normalize vector."""
        norm = np.linalg.norm(vector)
        if norm < 1e-7:
            return vector
        return vector / norm

    def normalize_lbph(self, lbph_features: np.ndarray) -> np.ndarray:
        """Normalize LBPH features."""
        return self._l2_normalize(lbph_features)

    def normalize_cnn(self, cnn_features: np.ndarray) -> np.ndarray:
        """Normalize CNN features."""
        return self._l2_normalize(cnn_features)

    def compute_lbph_similarity(
        self,
        query_lbph: np.ndarray,
        gallery_lbph: np.ndarray
    ) -> float:
        """
        Compute LBPH similarity (cosine similarity).

        Args:
            query_lbph: Query LBPH features (normalized)
            gallery_lbph: Gallery LBPH features (normalized)

        Returns:
            Similarity score [0, 1]
        """
        return float(np.dot(query_lbph, gallery_lbph))

    def compute_cnn_similarity(
        self,
        query_cnn: np.ndarray,
        gallery_cnn: np.ndarray
    ) -> float:
        """
        Compute CNN similarity (cosine similarity).

        Args:
            query_cnn: Query CNN features (normalized)
            gallery_cnn: Gallery CNN features (normalized)

        Returns:
            Similarity score [0, 1]
        """
        return float(np.dot(query_cnn, gallery_cnn))

    def compute_weights(self, quality_score: float) -> Dict[str, float]:
        """
        Compute fusion weights from quality score.

        Formula (revisi):
        wCNN = clip(0.65 + 0.15(Q - 0.5), 0.5, 0.8)
        wLBPH = 1 - wCNN

        Range:
        - CNN: 50% - 80%
        - LBPH: 20% - 50%

        Keuntungan:
        - LBPH selalu punya kontribusi (20-50%)
        - CNN lebih dominan saat kualitas bagus
        - Tidak ada komponen yang di-nol-kan

        Args:
            quality_score: Q ∈ [0, 1]

        Returns:
            Dictionary dengan w_lbph dan w_cnn
        """
        return get_quality_weights(quality_score)

    def fuse(
        self,
        lbph_similarity: float,
        cnn_similarity: float,
        quality_score: float
    ) -> float:
        """
        Fuse similarity scores using quality-aware weights.

        Final = wCNN × CNN_sim + wLBPH × LBPH_sim

        Args:
            lbph_similarity: LBPH cosine similarity [0, 1]
            cnn_similarity: CNN cosine similarity [0, 1]
            quality_score: Face quality score [0, 1]

        Returns:
            Final fused score [0, 1]
        """
        weights = self.compute_weights(quality_score)

        final_score = (
            weights['mobilefacenet'] * cnn_similarity +
            weights['lbph'] * lbph_similarity
        )

        return float(final_score)

    def fuse_batch(
        self,
        lbph_similarities: np.ndarray,
        cnn_similarities: np.ndarray,
        quality_score: float
    ) -> np.ndarray:
        """
        Fuse batch of similarity scores.

        Args:
            lbph_similarities: Array of LBPH similarities
            cnn_similarities: Array of CNN similarities
            quality_score: Quality score (same for all)

        Returns:
            Array of fused scores
        """
        weights = self.compute_weights(quality_score)

        fused = (
            weights['mobilefacenet'] * cnn_similarities +
            weights['lbph'] * lbph_similarities
        )

        return fused


class ScoreLevelGalleryMatcher:
    """
    Gallery Matcher dengan Score-Level Fusion.

    Mengelola dua gallery:
    1. LBPH Gallery - untuk matching berbasis tekstur
    2. CNN Gallery (FAISS) - untuk matching berbasis deep features
    """

    def __init__(self, gallery):
        """
        Args:
            gallery: FAISSGallery instance yang sudah punya CNN embeddings
        """
        self.gallery = gallery
        self.fusion = ScoreLevelFusion()

        # LBPH gallery (dictionary untuk brute force matching)
        self.lbph_gallery = {}  # nim -> list of normalized LBPH templates

    def register_lbph(self, nim: str, lbph_embedding: np.ndarray):
        """Register LBPH embedding for identity."""
        if nim not in self.lbph_gallery:
            self.lbph_gallery[nim] = []

        # Normalize and store
        normalized = self.fusion.normalize_lbph(lbph_embedding)
        self.lbph_gallery[nim].append(normalized)

    def register_from_gallery(self):
        """Register LBPH templates from main gallery (if available)."""
        # Ini akan dipanggil setelah enrollment
        # Main gallery akan memberikan LBPH templates
        pass

    def match_lbph(self, query_lbph: np.ndarray) -> List[Tuple[str, float]]:
        """
        Match query LBPH against LBPH gallery.

        Args:
            query_lbph: Query LBPH features

        Returns:
            list of (nim, similarity) sorted by similarity
        """
        query_norm = self.fusion.normalize_lbph(query_lbph)

        results = []
        for nim, templates in self.lbph_gallery.items():
            # Average similarity dengan semua templates
            sims = []
            for tmpl in templates:
                sim = self.fusion.compute_lbph_similarity(query_norm, tmpl)
                sims.append(sim)

            avg_sim = np.mean(sims)
            results.append((nim, avg_sim))

        # Sort by similarity descending
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def match_both(
        self,
        query_lbph: np.ndarray,
        query_cnn: np.ndarray,
        quality_score: float,
        top_k: int = 3
    ) -> List[Dict]:
        """
        Match using BOTH LBPH and CNN with score-level fusion.

        Args:
            query_lbph: Query LBPH features
            query_cnn: Query CNN features
            quality_score: Face quality score
            top_k: Number of top candidates to return

        Returns:
            List of dicts with nim, lbph_sim, cnn_sim, fused_score
        """
        # Match CNN using FAISS
        cnn_results = self.gallery.search_top_k(query_cnn, k=top_k * 2)

        # Match LBPH
        lbph_results = self.match_lbph(query_lbph)
        lbph_dict = {nim: sim for nim, sim in lbph_results}

        # Fusable candidates (yang ada di kedua gallery)
        cnn_nims = [nim for nim, _ in cnn_results]
        available_nims = [nim for nim in cnn_nims if nim in lbph_dict]

        if not available_nims:
            # Fallback: hanya CNN
            return [{'nim': nim, 'lbph_sim': 0, 'cnn_sim': sim, 'fused': sim}
                    for nim, sim in cnn_results[:top_k]]

        # Compute fused scores
        fused_results = []
        for nim in available_nims[:top_k]:
            cnn_sim = next(sim for n, sim in cnn_results if n == nim)
            lbph_sim = lbph_dict[nim]

            fused = self.fusion.fuse(lbph_sim, cnn_sim, quality_score)

            fused_results.append({
                'nim': nim,
                'lbph_sim': lbph_sim,
                'cnn_sim': cnn_sim,
                'fused': fused,
                'weights': self.fusion.compute_weights(quality_score)
            })

        # Sort by fused score
        fused_results.sort(key=lambda x: x['fused'], reverse=True)

        return fused_results[:top_k]


# Convenience functions
def fuse_scores(
    lbph_similarity: float,
    cnn_similarity: float,
    quality_score: float
) -> float:
    """
    Convenience function untuk score-level fusion.

    Rumus:
    Final = wCNN × CNN_sim + wLBPH × LBPH_sim
    dimana wCNN = QualityScore, wLBPH = 1 - QualityScore

    Contoh:
    - lbph_sim = 0.81, cnn_sim = 0.94, quality = 0.85
    - wCNN = 0.85, wLBPH = 0.15
    - Final = 0.85 × 0.94 + 0.15 × 0.81 = 0.92
    """
    fusion = ScoreLevelFusion()
    return fusion.fuse(lbph_similarity, cnn_similarity, quality_score)


def compute_quality_weights(quality_score: float) -> Dict[str, float]:
    """
    Convenience function untuk compute weights dari quality score.

    Returns:
        {'lbph': float, 'mobilefacenet': float}
    """
    return get_quality_weights(quality_score)


# Test function
if __name__ == "__main__":
    log.info("Testing Score-Level Fusion (Revisi Weight Formula)...")

    fusion = ScoreLevelFusion()

    # Test case
    lbph_sim = 0.81
    cnn_sim = 0.94
    quality = 0.85

    weights = fusion.compute_weights(quality)
    final = fusion.fuse(lbph_sim, cnn_sim, quality)

    log.info(f"\nScore-Level Fusion Example:")
    log.info(f"  LBPH Similarity: {lbph_sim}")
    log.info(f"  CNN Similarity: {cnn_sim}")
    log.info(f"  Quality Score: {quality}")
    log.info(f"")
    log.info(f"  Weight Formula: wCNN = clip(0.65 + 0.15(Q-0.5), 0.5, 0.8)")
    log.info(f"")
    log.info(f"  Weights:")
    log.info(f"    wCNN = {weights['mobilefacenet']:.3f}")
    log.info(f"    wLBPH = {weights['lbph']:.3f}")
    log.info(f"")
    log.info(f"  Final Score:")
    log.info(f"    = {weights['mobilefacenet']:.3f} × {cnn_sim} + {weights['lbph']:.3f} × {lbph_sim}")
    log.info(f"    = {weights['mobilefacenet'] * cnn_sim:.3f} + {weights['lbph'] * lbph_sim:.3f}")
    log.info(f"    = {final:.3f}")

    # Test with different quality scores
    log.info(f"\nWeight Analysis (Q ∈ [0,1]):")
    log.info(f"{'Q':>5} | {'wCNN':>6} | {'wLBPH':>6} | Final Score")
    log.info("-" * 40)
    for q in [0.0, 0.2, 0.4, 0.5, 0.6, 0.8, 1.0]:
        w = fusion.compute_weights(q)
        f = fusion.fuse(lbph_sim, cnn_sim, q)
        log.info(f"{q:>5.1f} | {w['mobilefacenet']:>6.3f} | {w['lbph']:>6.3f} | {f:.3f}")

    log.info(f"\nKesimpulan:")
    log.info(f"  - CNN: {fusion.config['weight']['min_cnn']:.0%} - {fusion.config['weight']['max_cnn']:.0%}")
    log.info(f"  - LBPH: {fusion.config['weight']['min_lbph']:.0%} - {fusion.config['weight']['max_lbph']:.0%}")
    log.info(f"  - LBPH selalu berkontribusi minimal {fusion.config['weight']['min_lbph']:.0%}")
