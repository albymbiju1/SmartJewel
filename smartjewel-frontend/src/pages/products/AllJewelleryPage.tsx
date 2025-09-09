import React from 'react';
import { ProductDisplay } from '../../components/ProductDisplay';

export const AllJewelleryPage: React.FC = () => {
  return (
    <ProductDisplay
      category="all"
      title="All Jewellery"
      description="Explore our complete collection of exquisite jewelry pieces crafted with precision and love"
    />
  );
};
