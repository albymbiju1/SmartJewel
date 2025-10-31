import { api, API_BASE_URL } from '../api';
import { CatalogItem } from './catalogService';

// User interaction types for building preference profiles
export interface UserInteraction {
  productId: string;
  type: 'view' | 'wishlist' | 'cart' | 'purchase';
  timestamp: Date;
  category?: string;
  metal?: string;
  purity?: string;
}

// Product features for KNN similarity calculation
export interface ProductFeatures {
  productId: string;
  category: string;
  metal: string;
  purity: string;
  price: number;
  weight: number;
}

// Recommendation result
export interface Recommendation {
  productId: string;
  similarityScore: number;
  name: string;
  image?: string;
  price?: number;
}

class RecommendationService {
  private userInteractions: UserInteraction[] = [];
  private productFeatures: Map<string, ProductFeatures> = new Map();

  // Track user interactions (views, wishlist adds, cart adds, purchases)
  trackInteraction(interaction: UserInteraction) {
    this.userInteractions.push(interaction);
    // Keep only recent interactions (last 100)
    if (this.userInteractions.length > 100) {
      this.userInteractions = this.userInteractions.slice(-100);
    }
    
    console.log('Tracked interaction:', interaction);
    console.log('Total interactions:', this.userInteractions.length);
  }

  // Build user preference profile based on interactions
  buildUserPreferenceProfile(): ProductFeatures | null {
    console.log('Building user preference profile');
    console.log('User interactions:', this.userInteractions);
    
    if (this.userInteractions.length === 0) {
      console.log('No user interactions found');
      return null;
    }

    // Weight interactions by type and recency
    const weights = {
      'view': 1,
      'wishlist': 3,
      'cart': 4,
      'purchase': 5
    };

    // Aggregate preferences
    let totalWeight = 0;
    let categoryScores: Record<string, number> = {};
    let metalScores: Record<string, number> = {};
    let purityScores: Record<string, number> = {};
    let totalPrice = 0;
    let totalWeightValue = 0;
    let priceCount = 0;
    let weightCount = 0;

    // Process recent interactions (last 50)
    const recentInteractions = this.userInteractions.slice(-50);
    console.log('Recent interactions:', recentInteractions);
    
    for (const interaction of recentInteractions) {
      const weight = weights[interaction.type] || 1;
      const timeFactor = this.calculateTimeDecayFactor(interaction.timestamp);
      const finalWeight = weight * timeFactor;
      
      totalWeight += finalWeight;
      
      if (interaction.category) {
        categoryScores[interaction.category] = (categoryScores[interaction.category] || 0) + finalWeight;
      }
      
      if (interaction.metal) {
        metalScores[interaction.metal] = (metalScores[interaction.metal] || 0) + finalWeight;
      }
      
      if (interaction.purity) {
        purityScores[interaction.purity] = (purityScores[interaction.purity] || 0) + finalWeight;
      }
      
      // Get price and weight from product features
      const productFeatures = this.productFeatures.get(interaction.productId);
      if (productFeatures) {
        totalPrice += productFeatures.price * finalWeight;
        totalWeightValue += productFeatures.weight * finalWeight;
        priceCount += finalWeight;
        weightCount += finalWeight;
      }
    }

    if (totalWeight === 0) {
      console.log('Total weight is 0, returning null');
      return null;
    }

    // Find most preferred category, metal, and purity
    const preferredCategory = Object.entries(categoryScores).reduce((a, b) => 
      a[1] > b[1] ? a : b)[0];
    
    const preferredMetal = Object.entries(metalScores).reduce((a, b) => 
      a[1] > b[1] ? a : b)[0];
    
    const preferredPurity = Object.entries(purityScores).reduce((a, b) => 
      a[1] > b[1] ? a : b)[0];

    // For price and weight, use weighted averages
    const avgPrice = priceCount > 0 ? totalPrice / priceCount : 50000; // Default fallback
    const avgWeight = weightCount > 0 ? totalWeightValue / weightCount : 5; // Default fallback

    const result = {
      productId: 'user_profile',
      category: preferredCategory,
      metal: preferredMetal,
      purity: preferredPurity,
      price: avgPrice,
      weight: avgWeight
    };
    
    console.log('User preference profile:', result);
    return result;
  }

  // Calculate time decay factor (more recent interactions have higher weight)
  private calculateTimeDecayFactor(timestamp: Date): number {
    const now = new Date();
    const diffHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    // Exponential decay - interactions within last 24h get full weight
    // After that, weight decreases by 10% per day
    if (diffHours <= 24) return 1.0;
    const days = diffHours / 24;
    const result = Math.max(0.1, Math.exp(-0.1 * days));
    console.log('Time decay factor for', timestamp, ':', result);
    return result;
  }

  // Calculate similarity between two product features using weighted Euclidean distance
  private calculateSimilarity(a: ProductFeatures, b: ProductFeatures): number {
    console.log('Calculating similarity between', a.productId, 'and', b.productId);
    // Normalize features for comparison
    const categorySimilarity = a.category === b.category ? 1 : 0;
    const metalSimilarity = a.metal === b.metal ? 1 : 0;
    const puritySimilarity = a.purity === b.purity ? 1 : 0;
    
    // Normalize numerical features (price, weight)
    const maxPrice = 500000; // Assumed max price
    const maxWeight = 50; // Assumed max weight in grams
    
    const priceSimilarity = 1 - Math.abs(a.price - b.price) / maxPrice;
    const weightSimilarity = 1 - Math.abs(a.weight - b.weight) / maxWeight;
    
    // Weighted combination of similarities
    const similarity = (
      categorySimilarity * 0.3 +
      metalSimilarity * 0.25 +
      puritySimilarity * 0.2 +
      priceSimilarity * 0.15 +
      weightSimilarity * 0.1
    );
    
    console.log('Similarity components:', {
      category: categorySimilarity,
      metal: metalSimilarity,
      purity: puritySimilarity,
      price: priceSimilarity,
      weight: weightSimilarity,
      total: similarity
    });
    
    const result = Math.max(0, similarity); // Ensure non-negative
    console.log('Final similarity result:', result);
    return result;
  }

  // KNN algorithm to find similar products
  findSimilarProducts(targetProduct: ProductFeatures, k: number = 5): Recommendation[] {
    console.log('Finding similar products for:', targetProduct);
    const similarities: { productId: string; similarity: number }[] = [];
    
    // Compare with all other products
    for (const [productId, features] of this.productFeatures.entries()) {
      if (productId === targetProduct.productId) {
        console.log('Skipping target product:', productId);
        continue; // Skip the target product itself
      }
      
      const similarity = this.calculateSimilarity(targetProduct, features);
      similarities.push({ productId, similarity });
    }
    
    console.log('Similarities calculated:', similarities);
    
    // Sort by similarity (descending) and take top k
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Return top k recommendations with actual product details
    const result = similarities.slice(0, k).map(({ productId, similarity }) => {
      const features = this.productFeatures.get(productId);
      // Try to get more complete product information if available
      return {
        productId,
        similarityScore: similarity,
        name: features ? `Product ${features.category} - ${features.metal}` : `Product ${productId.substring(0, 8)}`,
        // We'll populate image and price when we fetch detailed product info
      } as Recommendation;
    });
    
    console.log('Recommendations result:', result);
    return result;
  }

  // Get personalized recommendations for the current user
  async getRecommendations(k: number = 5): Promise<Recommendation[]> {
    console.log('Getting personalized recommendations');
    const userProfile = this.buildUserPreferenceProfile();
    console.log('User profile:', userProfile);
    
    if (!userProfile) {
      // If no user profile, return popular products
      console.log('No user profile, returning popular products');
      return this.getPopularProducts(k);
    }
    
    // Find similar products to user's preferences
    console.log('Finding similar products to user preferences');
    return this.findSimilarProducts(userProfile, k);
  }

  // Get popular products as fallback
  private async getPopularProducts(k: number): Promise<Recommendation[]> {
    console.log('Getting popular products as fallback');
    try {
      // Fetch popular products from backend
      const response = await api.get('/catalog/search?sort=newest&per_page=' + k);
      const products = response.data.results || [];
      console.log('Popular products:', products);
      
      const result = products.map((product: any) => {
        const imageUrl = product.image ? 
          (product.image.startsWith('http') ? product.image : `${API_BASE_URL}${product.image}`) : 
          undefined;
        console.log('Processing popular product image:', product.image, '->', imageUrl);
        
        return {
          productId: product._id,
          similarityScore: 0.5, // Placeholder score
          name: product.name,
          image: imageUrl,
          price: product.price
        };
      });
      
      console.log('Popular products with formatted images:', result);
      return result;
    } catch (error) {
      console.warn('Failed to fetch popular products:', error);
      return [];
    }
  }

  // Update product features database
  updateProductFeatures(products: CatalogItem[]) {
    console.log('Updating product features for', products.length, 'products');
    let count = 0;
    for (const product of products) {
      if (count < 5) { // Only log first 5 for debugging
        console.log('Product:', product._id, {
          category: product.category,
          metal: product.metal,
          purity: product.purity,
          price: product.price,
          weight: product.weight
        });
      }
      this.productFeatures.set(product._id, {
        productId: product._id,
        category: product.category || '',
        metal: product.metal || '',
        purity: product.purity || '',
        price: product.price || 0,
        weight: product.weight || 0
      });
      count++;
    }
    
    console.log(`Updated product features for ${this.productFeatures.size} products`);
    console.log('First 5 product features:', Array.from(this.productFeatures.entries()).slice(0, 5)); // Show first 5 entries
  }

  // Get recommendations for a specific product (similar items)
  async getSimilarProducts(productId: string, k: number = 5): Promise<Recommendation[]> {
    console.log('Getting similar products for:', productId);
    console.log('Current product features size:', this.productFeatures.size);
    console.log('Product features keys:', Array.from(this.productFeatures.keys()).slice(0, 10));
    
    const productFeatures = this.productFeatures.get(productId);
    
    if (!productFeatures) {
      console.warn(`Product features not found for product ${productId}`);
      console.log('Available product features:', Array.from(this.productFeatures.entries()).slice(0, 5));
      // Try to fetch from backend
      try {
        console.log('Fetching product details from catalog search for ID:', productId);
        const response = await api.get(`/catalog/search?q=_id:${productId}`);
        console.log('Catalog search response:', response);
        const products = response.data.results || [];
        console.log('Fetched product details:', products);
        if (products.length > 0) {
          this.updateProductFeatures(products);
          const updatedFeatures = this.productFeatures.get(productId);
          if (updatedFeatures) {
            return this.findSimilarProducts(updatedFeatures, k);
          }
        }
      } catch (error) {
        console.error('Failed to fetch product details:', error);
      }
      return [];
    }
    
    console.log('Found product features:', productFeatures);
    const result = this.findSimilarProducts(productFeatures, k);
    console.log('Similar products result:', result);
    return result;
  }
  
  // Get product details for recommendations
  async getProductDetails(productIds: string[]): Promise<any[]> {
    try {
      if (productIds.length === 0) {
        console.log('No product IDs to fetch details for');
        return [];
      }
      
      console.log('Fetching product details for IDs:', productIds);
      
      // Fetch all products from inventory
      console.log('Fetching all inventory products');
      const response = await api.get('/inventory/products');
      const allProducts = response.data.products || [];
      console.log('All inventory products fetched:', allProducts.length);
      
      // Log sample product structure
      if (allProducts.length > 0) {
        console.log('Sample product structure:', allProducts[0]);
      }
      
      // Log some sample product IDs for comparison
      console.log('First 10 product IDs from inventory:');
      allProducts.slice(0, 10).forEach((product: any, index: number) => {
        console.log(`  ${index}: ${product._id} (${typeof product._id})`);
      });
      
      console.log('Requested product IDs:');
      productIds.forEach((id, index: number) => {
        console.log(`  ${index}: ${id} (${typeof id})`);
      });
      
      // Filter products by the requested IDs with multiple matching strategies
      console.log('Filtering products by requested IDs using multiple strategies...');
      const filteredProducts = allProducts.filter((product: any) => {
        const productId = product._id;
        
        // Strategy 1: Exact match
        if (productIds.includes(productId)) {
          console.log('Exact match found for product:', productId);
          return true;
        }
        
        // Strategy 2: String conversion match
        const stringMatch = productIds.some(requestedId => 
          String(requestedId) === String(productId)
        );
        if (stringMatch) {
          console.log('String conversion match found for product:', productId);
          return true;
        }
        
        return false;
      });
      
      console.log('Filtered products by IDs:', filteredProducts);
      
      // If no products found, create mock products with placeholder data
      if (filteredProducts.length === 0) {
        console.log('No products found for requested IDs, creating mock products');
        const mockProducts = productIds.map((id, index) => ({
          _id: id,
          name: `Recommended Product ${index + 1}`,
          price: Math.floor(Math.random() * 100000) + 10000,
          image: undefined // No image available
        }));
        console.log('Mock products created:', mockProducts);
        return mockProducts;
      }
      
      // Ensure image URLs are properly formatted
      const formattedResults = filteredProducts.map((product: any) => {
        const imageUrl = product.image ? 
          (product.image.startsWith('http') ? product.image : `${API_BASE_URL}${product.image}`) : 
          undefined;
        console.log('Processing product image:', product.image, '->', imageUrl);
        
        return {
          ...product,
          image: imageUrl
        };
      });
      
      console.log('Products with formatted images:', formattedResults);
      return formattedResults;
    } catch (error) {
      console.error('Failed to fetch product details:', error);
      // Return mock products as fallback
      console.log('Returning mock products as fallback');
      const mockProducts = productIds.map((id, index) => ({
        _id: id,
        name: `Recommended Product ${index + 1}`,
        price: Math.floor(Math.random() * 100000) + 10000,
        image: undefined // No image available
      }));
      return mockProducts;
    }
  }
}

// Export singleton instance
export const recommendationService = new RecommendationService();