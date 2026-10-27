"""
Adaptive Feature Fusion Module
==============================
Enhanced fusion with:
1. Dense projection layers for each feature branch
2. L2 normalization per branch
3. Adaptive weight adjustment based on image quality
4. Weighted combination

This replaces the simple concatenation with a learned projection approach.

Author: Skripsi 2026
"""

import numpy as np
from typing import Dict, Tuple, Optional
import logging
import os

from config import (
    LBPH_DIM, CNN_DIM, FUSION_DIM,
    FUSION_HIDDEN_DIM, FINAL_EMBEDDING_DIM,
    ADAPTIVE_FUSION_CONFIG, IMG_SIZE_LBPH, IMG_SIZE_CNN
)

log = logging.getLogger(__name__)


class AdaptiveFusion:
    """
    Adaptive Feature Fusion with learned projections.

    Architecture:
    ┌─────────────────────────────────────────────────────────────┐
    │                                                             │
    │  LBPH Features ──► Dense(256) ──► L2Norm ──┐              │
    │  (640-D)                                   │              │
    │                                             │              │
    │                                             ▼              │
    │  MobileFaceNet ──► Dense(256) ──► L2Norm ──┼──► Fuse     │
    │  (512-D)                                   │              │
    │                                             │              │
    │  Quality Scores ──► Weight Calculator ──────┘              │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘

    Instead of simple concatenation:
    - Each branch is projected to a common space (256-D)
    - L2 normalized
    - Weighted combination based on quality
    """

    def __init__(self, use_learned_fusion: bool = True):
        """
        Initialize Adaptive Fusion.

        Args:
            use_learned_fusion: If True, use learned projections.
                               If False, use weighted simple fusion.
        """
        self.use_learned_fusion = use_learned_fusion
        self.config = ADAPTIVE_FUSION_CONFIG

        # Initialize projection matrices (simulated Dense layers)
        # These can be learned from data or pre-set
        self._init_projections()

        # Batch normalization stats (for stability)
        self._bn_running_mean_lbph = np.zeros(LBPH_DIM)
        self._bn_running_var_lbph = np.ones(LBPH_DIM)
        self._bn_running_mean_cnn = np.zeros(CNN_DIM)
        self._bn_running_var_cnn = np.ones(CNN_DIM)

    def _init_projections(self):
        """Initialize projection matrices for Dense layers."""
        # Xavier/Glorot initialization
        scale_lbph = np.sqrt(2.0 / (LBPH_DIM + FUSION_HIDDEN_DIM))
        scale_cnn = np.sqrt(2.0 / (CNN_DIM + FUSION_HIDDEN_DIM))

        # Projection: 640 -> 256 for LBPH
        self.W_lbph = np.random.randn(FUSION_HIDDEN_DIM, LBPH_DIM) * scale_lbph
        self.b_lbph = np.zeros(FUSION_HIDDEN_DIM)

        # Projection: 512 -> 256 for MobileFaceNet
        self.W_cnn = np.random.randn(FUSION_HIDDEN_DIM, CNN_DIM) * scale_cnn
        self.b_cnn = np.zeros(FUSION_HIDDEN_DIM)

    def _l2_normalize(self, vector: np.ndarray, eps: float = 1e-7) -> np.ndarray:
        """L2 normalize a vector."""
        norm = np.linalg.norm(vector)
        if norm < eps:
            return vector
        return vector / norm

    def _batch_norm(
        self,
        x: np.ndarray,
        running_mean: np.ndarray,
        running_var: np.ndarray,
        weight: np.ndarray = None,
        bias: np.ndarray = None,
        eps: float = 1e-5
    ) -> np.ndarray:
        """Simulated batch normalization."""
        if len(x.shape) == 1:
            x = x.reshape(1, -1)

        # Use running stats if available
        mean = running_mean
        var = running_var

        # Normalize
        x_norm = (x - mean) / np.sqrt(var + eps)

        # Scale and shift
        if weight is not None and bias is not None:
            x_norm = x_norm * weight + bias

        return x_norm[0] if x_norm.shape[0] == 1 else x_norm

    def _dense_layer(
        self,
        x: np.ndarray,
        W: np.ndarray,
        b: np.ndarray,
        activation: str = 'relu'
    ) -> np.ndarray:
        """
        Dense layer operation.

        Args:
            x: Input vector
            W: Weight matrix
            b: Bias vector
            activation: Activation function ('relu' or 'linear')

        Returns:
            Output vector
        """
        # Linear transformation
        y = np.dot(W, x) + b

        # Activation
        if activation == 'relu':
            y = np.maximum(0, y)

        return y

    def project_lbph(self, lbph_features: np.ndarray) -> np.ndarray:
        """
        Project LBPH features to common space.

        Args:
            lbph_features: LBPH feature vector (640-D)

        Returns:
            Projected vector (256-D), L2 normalized
        """
        # Batch normalize
        bn_weight = np.ones(LBPH_DIM)  # Scale factor
        bn_bias = np.zeros(LBPH_DIM)   # Shift

        x = self._batch_norm(
            lbph_features,
            self._bn_running_mean_lbph,
            self._bn_running_var_lbph,
            bn_weight, bn_bias
        )

        # Dense layer
        dense = self._dense_layer(x, self.W_lbph, self.b_lbph, activation='relu')

        # L2 normalize
        return self._l2_normalize(dense)

    def project_mobilefacenet(self, cnn_features: np.ndarray) -> np.ndarray:
        """
        Project MobileFaceNet features to common space.

        Args:
            cnn_features: CNN feature vector (512-D)

        Returns:
            Projected vector (256-D), L2 normalized
        """
        # Batch normalize
        bn_weight = np.ones(CNN_DIM)
        bn_bias = np.zeros(CNN_DIM)

        x = self._batch_norm(
            cnn_features,
            self._bn_running_mean_cnn,
            self._bn_running_var_cnn,
            bn_weight, bn_bias
        )

        # Dense layer
        dense = self._dense_layer(x, self.W_cnn, self.b_cnn, activation='relu')

        # L2 normalize
        return self._l2_normalize(dense)

    def get_adaptive_weights(
        self,
        quality_scores: Optional[Dict] = None
    ) -> Dict[str, float]:
        """
        Calculate adaptive weights based on quality scores.

        Args:
            quality_scores: Quality assessment dictionary (optional)

        Returns:
            Dictionary with lbph and mobilefacenet weights
        """
        if quality_scores is None or not self.config.get('enabled', True):
            return self.config['default_weights'].copy()

        adj = self.config['quality_adjustment']

        # Get individual scores
        blur_score = quality_scores.get('blur', {}).get('score', 0.5)
        brightness_score = quality_scores.get('brightness', {}).get('score', 0.5)
        pose_score = quality_scores.get('pose', {}).get('score', 0.5)
        total_score = quality_scores.get('total_score', 0.5)

        # Decision tree for weight selection
        if blur_score < 0.5:
            # High blur → rely more on MobileFaceNet (deeper features)
            return adj['high_blur'].copy()

        elif brightness_score < 0.5:
            # Bad lighting → rely more on LBPH (enhanced by CLAHE)
            return adj['bad_lighting'].copy()

        elif pose_score < 0.6:
            # Bad pose → rely more on MobileFaceNet
            return adj['bad_pose'].copy()

        elif total_score >= 0.8:
            # Excellent quality → balanced
            return adj['excellent'].copy()

        else:
            # Default balanced weights
            return self.config['default_weights'].copy()

    def fuse(
        self,
        lbph_features: np.ndarray,
        cnn_features: np.ndarray,
        quality_scores: Optional[Dict] = None
    ) -> np.ndarray:
        """
        Fuse LBPH and MobileFaceNet features.

        Args:
            lbph_features: LBPH feature vector (640-D)
            cnn_features: MobileFaceNet feature vector (512-D)
            quality_scores: Quality assessment (optional)

        Returns:
            Final embedding vector (512-D), L2 normalized
        """
        if self.use_learned_fusion:
            # Method 1: Learned projection + weighted combination
            # Project to common space
            proj_lbph = self.project_lbph(lbph_features)
            proj_cnn = self.project_mobilefacenet(cnn_features)

            # Get adaptive weights
            weights = self.get_adaptive_weights(quality_scores)

            # Weighted combination
            fused = (
                weights['lbph'] * proj_lbph +
                weights['mobilefacenet'] * proj_cnn
            )
        else:
            # Method 2: Simple weighted concatenation (no learned projection)
            # Get adaptive weights
            weights = self.get_adaptive_weights(quality_scores)

            # Normalize each branch
            norm_lbph = self._l2_normalize(lbph_features)
            norm_cnn = self._l2_normalize(cnn_features)

            # Scale by weights and concatenate
            fused = np.concatenate([
                weights['lbph'] * norm_lbph,
                weights['mobilefacenet'] * norm_cnn
            ])

        # Final L2 normalization
        return self._l2_normalize(fused)

    def extract_embedding(
        self,
        face: np.ndarray,
        lbph_extractor,
        cnn_extractor,
        quality_scores: Optional[Dict] = None
    ) -> np.ndarray:
        """
        Full embedding extraction with adaptive fusion.

        Args:
            face: Face crop (BGR)
            lbph_extractor: LBPH extractor instance
            cnn_extractor: MobileFaceNet extractor instance
            quality_scores: Quality assessment (optional)

        Returns:
            Final embedding (512-D)
        """
        # Extract features
        lbph_features = lbph_extractor.extract(face)
        cnn_features = cnn_extractor.extract(face)

        # Fuse
        return self.fuse(lbph_features, cnn_features, quality_scores)


class SimpleFusion:
    """
    Simple concatenation fusion (for backward compatibility).

    This is the original simple fusion:
    Concatenate → L2 Normalize
    """

    def __init__(self):
        pass

    def fuse(
        self,
        lbph_features: np.ndarray,
        cnn_features: np.ndarray,
        quality_scores: Optional[Dict] = None
    ) -> np.ndarray:
        """
        Simple concatenation fusion.

        Args:
            lbph_features: LBPH vector (640-D)
            cnn_features: CNN vector (512-D)
            quality_scores: Not used (for API compatibility)

        Returns:
            Concatenated, L2 normalized vector (1152-D)
        """
        # Concatenate
        fused = np.concatenate([lbph_features, cnn_features])

        # L2 normalize
        norm = np.linalg.norm(fused)
        if norm > 1e-7:
            return fused / norm
        return fused

    def get_adaptive_weights(self, quality_scores=None) -> Dict[str, float]:
        """Return default weights (for API compatibility)."""
        return {'lbph': 0.35, 'mobilefacenet': 0.65}


class WeightedSimpleFusion:
    """
    Weighted simple fusion without projection layers.

    This is an intermediate approach:
    1. L2 normalize each branch
    2. Weight adjustment based on quality
    3. Weighted concatenation
    """

    def __init__(self):
        self.config = ADAPTIVE_FUSION_CONFIG

    def _l2_normalize(self, vector: np.ndarray) -> np.ndarray:
        """L2 normalize."""
        norm = np.linalg.norm(vector)
        if norm < 1e-7:
            return vector
        return vector / norm

    def get_adaptive_weights(
        self,
        quality_scores: Optional[Dict] = None
    ) -> Dict[str, float]:
        """Calculate adaptive weights based on quality."""
        if quality_scores is None:
            return self.config['default_weights'].copy()

        adj = self.config['quality_adjustment']

        blur_score = quality_scores.get('blur', {}).get('score', 0.5)
        brightness_score = quality_scores.get('brightness', {}).get('score', 0.5)
        pose_score = quality_scores.get('pose', {}).get('score', 0.5)
        total_score = quality_scores.get('total_score', 0.5)

        if blur_score < 0.5:
            return adj['high_blur'].copy()
        elif brightness_score < 0.5:
            return adj['bad_lighting'].copy()
        elif pose_score < 0.6:
            return adj['bad_pose'].copy()
        elif total_score >= 0.8:
            return adj['excellent'].copy()
        else:
            return self.config['default_weights'].copy()

    def fuse(
        self,
        lbph_features: np.ndarray,
        cnn_features: np.ndarray,
        quality_scores: Optional[Dict] = None
    ) -> np.ndarray:
        """
        Weighted concatenation fusion.

        Args:
            lbph_features: LBPH vector (640-D)
            cnn_features: CNN vector (512-D)
            quality_scores: Quality assessment (optional)

        Returns:
            Weighted, concatenated, L2 normalized vector
        """
        # Normalize each branch
        norm_lbph = self._l2_normalize(lbph_features)
        norm_cnn = self._l2_normalize(cnn_features)

        # Get weights
        weights = self.get_adaptive_weights(quality_scores)

        # Weighted concatenation
        # Scale LBPH and CNN by their respective weights
        scaled_lbph = norm_lbph * weights['lbph']
        scaled_cnn = norm_cnn * weights['mobilefacenet']

        fused = np.concatenate([scaled_lbph, scaled_cnn])

        # Final L2 normalize
        return self._l2_normalize(fused)


def create_fusion(method: str = 'adaptive') -> object:
    """
    Factory function to create fusion method.

    Args:
        method: 'adaptive', 'weighted', or 'simple'

    Returns:
        Fusion instance
    """
    if method == 'adaptive':
        return AdaptiveFusion(use_learned_fusion=True)
    elif method == 'weighted':
        return WeightedSimpleFusion()
    else:  # 'simple'
        return SimpleFusion()


# Convenience function
def fuse_features(
    lbph_features: np.ndarray,
    cnn_features: np.ndarray,
    quality_scores: Optional[Dict] = None,
    method: str = 'adaptive'
) -> np.ndarray:
    """
    Convenience function for feature fusion.

    Args:
        lbph_features: LBPH vector (640-D)
        cnn_features: CNN vector (512-D)
        quality_scores: Quality assessment (optional)
        method: 'adaptive', 'weighted', or 'simple'

    Returns:
        Fused embedding vector
    """
    fusion = create_fusion(method)
    return fusion.fuse(lbph_features, cnn_features, quality_scores)


# Test function
if __name__ == "__main__":
    log.info("Testing AdaptiveFusion...")

    # Create fusion
    fusion = AdaptiveFusion(use_learned_fusion=True)

    # Simulate features
    lbph = np.random.randn(LBPH_DIM).astype(np.float32)
    cnn = np.random.randn(CNN_DIM).astype(np.float32)

    # Simulate quality scores
    quality = {
        'blur': {'score': 0.8},
        'brightness': {'score': 0.9},
        'pose': {'score': 0.7},
        'total_score': 0.8
    }

    # Test fusion
    weights = fusion.get_adaptive_weights(quality)
    log.info(f"Adaptive weights: {weights}")

    embedding = fusion.fuse(lbph, cnn, quality)
    log.info(f"Embedding shape: {embedding.shape}")
    log.info(f"Embedding norm: {np.linalg.norm(embedding):.4f}")

    # Test different quality scenarios
    scenarios = [
        {'blur': {'score': 0.3}, 'brightness': {'score': 0.8}, 'pose': {'score': 0.8}, 'total_score': 0.5},
        {'blur': {'score': 0.9}, 'brightness': {'score': 0.2}, 'pose': {'score': 0.8}, 'total_score': 0.5},
        {'blur': {'score': 0.9}, 'brightness': {'score': 0.9}, 'pose': {'score': 0.9}, 'total_score': 0.9},
    ]

    log.info("\nWeight scenarios:")
    for i, q in enumerate(scenarios):
        w = fusion.get_adaptive_weights(q)
        log.info(f"  Scenario {i+1}: LBPH={w['lbph']:.2f}, CNN={w['mobilefacenet']:.2f}")
