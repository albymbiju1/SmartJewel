import React from 'react';
import { ProductDisplay } from '../../components/ProductDisplay';

export const GoldCollectionPage: React.FC = () => {
  return (
    <ProductDisplay
      category="gold"
      title="Gold Collection"
      description="Discover our stunning range of gold jewelry, from traditional designs to contemporary masterpieces"
    />
  );
};
