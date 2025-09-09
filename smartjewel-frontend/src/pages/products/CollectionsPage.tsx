import React from 'react';
import { ProductDisplay } from '../../components/ProductDisplay';

export const CollectionsPage: React.FC = () => {
  return (
    <ProductDisplay
      category="collections"
      title="Special Collections"
      description="Discover our premium and limited edition collections featuring rare designs and exceptional craftsmanship"
    />
  );
};
