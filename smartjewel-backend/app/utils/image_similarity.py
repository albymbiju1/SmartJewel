"""
Image similarity utility for visual search using deep learning.
Uses pre-trained ResNet50 to extract feature vectors and compute similarity.
"""

import io
import numpy as np
from PIL import Image
import torch
import torchvision.transforms as transforms
import torchvision.models as models
from sklearn.metrics.pairwise import cosine_similarity
from typing import Union, Tuple
import requests


class ImageSimilarityEngine:
    """
    Engine for computing similarity between images using ResNet50 features.
    """
    
    def __init__(self):
        """Initialize the model and preprocessing pipeline."""
        # Load pre-trained ResNet50 (handle both old and new PyTorch syntax)
        try:
            # Try newer PyTorch syntax (v0.13+)
            from torchvision.models import ResNet50_Weights
            self.model = models.resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)
        except ImportError:
            # Fallback to older syntax for PyTorch < 0.13
            self.model = models.resnet50(pretrained=True)
        
        # Remove the final classification layer to get features
        self.model = torch.nn.Sequential(*list(self.model.children())[:-1])
        self.model.eval()  # Set to evaluation mode
        
        # Image preprocessing pipeline (ResNet expects 224x224 images)
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],  # ImageNet normalization
                std=[0.229, 0.224, 0.225]
            )
        ])
        
        # Move to GPU if available
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = self.model.to(self.device)
        
    def load_image_from_file(self, file_path: str) -> Image.Image:
        """
        Load image from file path.
        
        Args:
            file_path: Path to image file
            
        Returns:
            PIL Image object
        """
        return Image.open(file_path).convert('RGB')
    
    def load_image_from_bytes(self, image_bytes: bytes) -> Image.Image:
        """
        Load image from bytes (e.g., uploaded file).
        
        Args:
            image_bytes: Image data as bytes
            
        Returns:
            PIL Image object
        """
        return Image.open(io.BytesIO(image_bytes)).convert('RGB')
    
    def load_image_from_url(self, url: str, timeout: int = 10) -> Image.Image:
        """
        Load image from URL.
        
        Args:
            url: Image URL
            timeout: Request timeout in seconds
            
        Returns:
            PIL Image object
        """
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert('RGB')
    
    def extract_features(self, image: Union[str, bytes, Image.Image]) -> np.ndarray:
        """
        Extract feature vector from image using ResNet50.
        
        Args:
            image: Can be file path (str), bytes, or PIL Image
            
        Returns:
            Feature vector as numpy array (2048 dimensions)
        """
        # Load image if needed
        if isinstance(image, str):
            if image.startswith('http://') or image.startswith('https://'):
                img = self.load_image_from_url(image)
            else:
                img = self.load_image_from_file(image)
        elif isinstance(image, bytes):
            img = self.load_image_from_bytes(image)
        else:
            img = image  # Already a PIL Image
        
        # Preprocess image
        img_tensor = self.transform(img).unsqueeze(0)  # Add batch dimension
        img_tensor = img_tensor.to(self.device)
        
        # Extract features
        with torch.no_grad():
            features = self.model(img_tensor)
        
        # Flatten and convert to numpy
        features = features.squeeze().cpu().numpy()
        
        # Normalize for cosine similarity
        features = features / np.linalg.norm(features)
        
        return features
    
    def extract_features_batch(self, images: list) -> list:
        """
        Extract features from multiple images in a batch for better performance.
        
        Args:
            images: List of images (can be file paths, bytes, or PIL Images)
            
        Returns:
            List of feature vectors
        """
        batch_tensors = []
        
        # Load and preprocess all images
        for image in images:
            try:
                # Load image if needed
                if isinstance(image, str):
                    if image.startswith('http://') or image.startswith('https://'):
                        img = self.load_image_from_url(image)
                    else:
                        img = self.load_image_from_file(image)
                elif isinstance(image, bytes):
                    img = self.load_image_from_bytes(image)
                else:
                    img = image  # Already a PIL Image
                
                # Preprocess and add to batch
                img_tensor = self.transform(img)
                batch_tensors.append(img_tensor)
            except Exception as e:
                print(f"Error loading image: {str(e)}")
                # Add a zero tensor as placeholder for failed images
                batch_tensors.append(torch.zeros(3, 224, 224))
        
        if not batch_tensors:
            return []
        
        # Stack into batch and move to device
        batch = torch.stack(batch_tensors).to(self.device)
        
        # Extract features for entire batch
        with torch.no_grad():
            features = self.model(batch)
        
        # Process each feature vector
        features = features.squeeze().cpu().numpy()
        
        # Handle single image case
        if len(images) == 1:
            features = features.reshape(1, -1)
        
        # Normalize each feature vector
        feature_list = []
        for feat in features:
            feat = feat / np.linalg.norm(feat)
            feature_list.append(feat)
        
        return feature_list
    
    def compute_similarity(
        self, 
        features1: np.ndarray, 
        features2: np.ndarray
    ) -> float:
        """
        Compute cosine similarity between two feature vectors.
        
        Args:
            features1: First feature vector
            features2: Second feature vector
            
        Returns:
            Similarity score between 0 and 1
        """
        # Reshape for sklearn
        f1 = features1.reshape(1, -1)
        f2 = features2.reshape(1, -1)
        
        # Compute cosine similarity
        similarity = cosine_similarity(f1, f2)[0][0]
        
        # Clip to [0, 1] range (should already be, but just in case)
        return float(np.clip(similarity, 0, 1))
    
    def find_similar_images(
        self,
        query_image: Union[str, bytes, Image.Image],
        candidate_images: list,
        top_k: int = 20,
        min_similarity: float = 0.3,
        batch_size: int = 32
    ) -> list:
        """
        Find most similar images from a list of candidates using batch processing.
        
        Args:
            query_image: Image to search for
            candidate_images: List of tuples (id, image_path_or_url)
            top_k: Number of top results to return
            min_similarity: Minimum similarity threshold
            batch_size: Number of images to process in each batch
            
        Returns:
            List of tuples (id, similarity_score) sorted by similarity
        """
        # Extract features from query image
        query_features = self.extract_features(query_image)
        
        results = []
        
        # Process candidates in batches for better performance
        for i in range(0, len(candidate_images), batch_size):
            batch = candidate_images[i:i + batch_size]
            batch_ids = [item[0] for item in batch]
            batch_images = [item[1] for item in batch]
            
            try:
                # Extract features for batch
                batch_features = self.extract_features_batch(batch_images)
                
                # Compute similarity for each in batch
                for item_id, features in zip(batch_ids, batch_features):
                    try:
                        similarity = self.compute_similarity(query_features, features)
                        
                        # Only include if above threshold
                        if similarity >= min_similarity:
                            results.append((item_id, similarity))
                    except Exception as e:
                        print(f"Error computing similarity for {item_id}: {str(e)}")
                        continue
                        
            except Exception as e:
                print(f"Error processing batch {i}-{i+batch_size}: {str(e)}")
                # Fallback to individual processing for this batch
                for item_id, candidate_image in batch:
                    try:
                        candidate_features = self.extract_features(candidate_image)
                        similarity = self.compute_similarity(query_features, candidate_features)
                        
                        if similarity >= min_similarity:
                            results.append((item_id, similarity))
                    except Exception as e:
                        print(f"Error processing candidate {item_id}: {str(e)}")
                        continue
        
        # Sort by similarity (descending) and return top K
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]


# Singleton instance
_engine = None

def get_similarity_engine() -> ImageSimilarityEngine:
    """
    Get or create singleton instance of ImageSimilarityEngine.
    Lazy loading to avoid loading model on import.
    """
    global _engine
    if _engine is None:
        _engine = ImageSimilarityEngine()
    return _engine

