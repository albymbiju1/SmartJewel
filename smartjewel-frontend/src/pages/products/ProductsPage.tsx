import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductDisplay } from '../../components/ProductDisplay';
import Navbar from '../../components/Navbar';

export const ProductsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');

  // Map category names to display titles and descriptions
  const categoryData = useMemo(() => {
    const mappings: Record<string, { title: string; description: string }> = {
      'bangles': {
        title: 'Bangles Collection',
        description: 'Discover our exquisite collection of traditional and modern bangles'
      },
      'chains': {
        title: 'Chains Collection',
        description: 'Elegant chains for every occasion - from delicate to statement pieces'
      },
      'pendants': {
        title: 'Pendants Collection',
        description: 'Beautiful pendants that add charm to any outfit'
      },
      'mangalsutra': {
        title: 'Mangalsutra Collection',
        description: 'Sacred symbols of matrimony, crafted with tradition and elegance'
      },
      'bracelets': {
        title: 'Bracelets Collection',
        description: 'Stylish bracelets that complement your personality'
      },
      'rings': {
        title: 'Finger Rings Collection',
        description: 'Stunning rings for special moments and everyday elegance'
      },
      'earrings': {
        title: 'Earrings Collection',
        description: 'From studs to chandeliers, find your perfect pair'
      },
      'necklaces': {
        title: 'Necklaces Collection',
        description: 'Statement necklaces that define elegance'
      },
      'necklace-set': {
        title: 'Necklace Set Collection',
        description: 'Perfectly paired necklace sets for special occasions'
      },
      'nose-pin': {
        title: 'Nose Pin Collection',
        description: 'Delicate nose pins crafted to highlight your style'
      },
      'gold': {
        title: 'Gold Collection',
        description: 'Pure gold jewelry that stands the test of time'
      },
      'diamond': {
        title: 'Diamond Collection',
        description: 'Brilliant diamonds that capture light and hearts'
      },
      'wedding': {
        title: 'Wedding Collection',
        description: 'Complete your special day with our wedding jewelry'
      },
      'gifting': {
        title: 'Gifting Collection',
        description: 'Perfect gifts for your loved ones'
      },
      'collections': {
        title: 'Premium Collections',
        description: 'Our exclusive designer collections'
      }
    };

    const defaultData = {
      title: 'All Jewellery',
      description: 'Explore our complete collection of fine jewelry'
    };

    return category ? (mappings[category.toLowerCase()] || defaultData) : defaultData;
  }, [category]);

  return (
    <>
      <Navbar />
      <ProductDisplay 
        category={category || 'all'} 
        title={categoryData.title}
        description={categoryData.description}
      />
    </>
  );
};
