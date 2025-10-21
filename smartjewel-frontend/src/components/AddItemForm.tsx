import React, { useState, useCallback } from 'react';

interface FormData {
  sku: string;
  name: string;
  category: string;
  sub_category: string;
  metal: string;
  purity: string;
  weight_unit: string;
  weight: number;
  price: number;
  description: string;
  gemstones: string;
  color: string;
  style: string;
  tags: string;
  brand: string;
}

interface AddItemFormProps {
  onSubmit: (formData: FormData, imageFile: File | null) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  initialData?: Partial<FormData>;
}

export const AddItemForm: React.FC<AddItemFormProps> = ({ 
  onSubmit, 
  onCancel, 
  isEdit = false, 
  initialData = {} 
}) => {
  const [formData, setFormData] = useState<FormData>({
    sku: initialData.sku || '',
    name: initialData.name || '',
    category: initialData.category || '',
    sub_category: initialData.sub_category || '',
    metal: initialData.metal || '',
    purity: initialData.purity || '',
    weight_unit: initialData.weight_unit || 'g',
    weight: initialData.weight || 0,
    price: initialData.price || 0,
    description: initialData.description || '',
    gemstones: Array.isArray(initialData.gemstones) ? initialData.gemstones.join(', ') : (initialData.gemstones || ''),
    color: initialData.color || '',
    style: initialData.style || '',
    tags: Array.isArray(initialData.tags) ? initialData.tags.join(', ') : (initialData.tags || ''),
    brand: initialData.brand || 'Smart Jewel'
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const categories = [
    'Rings', 'Necklaces', 'Earrings', 'Bracelets', 'Bangles', 
    'Pendants', 'Chains', 'Mangalsutra', 'Nose Pin', 'Anklets', 'Toe Rings', 'Coins'
  ];
  const metals = ['Gold', 'Silver', 'Platinum', 'Diamond', 'White Gold', 'Rose Gold'];
  const purities = ['24K', '22K', '18K', '14K', '10K', '925 Silver', 'Pure Platinum'];
  const colors = ['Yellow Gold', 'Rose Gold', 'White Gold', 'Silver'];
  const styles = ['Modern', 'Traditional', 'Vintage', 'Contemporary', 'Classic'];
  const commonGemstones = ['Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'Topaz', 'Amethyst', 'Garnet', 'Opal', 'Turquoise'];

  // Individual field handlers to prevent re-rendering
  const updateField = useCallback((field: keyof FormData) => (value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitting with data:', formData);
    await onSubmit(formData, imageFile);
  }, [formData, imageFile, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Image Upload */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {imagePreview && (
              <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border" />
            )}
          </div>
        </div>

        {/* SKU */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
          <input 
            type="text"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="e.g., GR001" 
            value={formData.sku}
            onChange={(e) => updateField('sku')(e.target.value)}
            required 
          />
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input 
            type="text"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="e.g., Diamond Gold Ring" 
            value={formData.name}
            onChange={(e) => updateField('name')(e.target.value)}
            required 
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select 
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            value={formData.category}
            onChange={(e) => updateField('category')(e.target.value)}
            required
          >
            <option value="">Select Category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Metal */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Metal *</label>
          <select 
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            value={formData.metal}
            onChange={(e) => updateField('metal')(e.target.value)}
            required
          >
            <option value="">Select Metal</option>
            {metals.map(metal => (
              <option key={metal} value={metal}>{metal}</option>
            ))}
          </select>
        </div>

        {/* Purity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purity *</label>
          <select 
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            value={formData.purity}
            onChange={(e) => updateField('purity')(e.target.value)}
            required
          >
            <option value="">Select Purity</option>
            {purities.map(purity => (
              <option key={purity} value={purity}>{purity}</option>
            ))}
          </select>
        </div>

        {/* Weight */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
          <div className="flex space-x-2">
            <input 
              type="number" 
              step="0.01"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder="0.00" 
              value={formData.weight === 0 ? '' : formData.weight}
              onChange={(e) => updateField('weight')(e.target.value === '' ? 0 : Number(e.target.value))}
            />
            <select 
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
              value={formData.weight_unit}
              onChange={(e) => updateField('weight_unit')(e.target.value)}
            >
              <option value="g">g</option>
              <option value="mg">mg</option>
            </select>
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
          <input 
            type="number" 
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="Enter price" 
            value={formData.price === 0 ? '' : formData.price}
            onChange={(e) => updateField('price')(e.target.value === '' ? 0 : Number(e.target.value))}
          />
        </div>

        {/* Sub Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
          <input 
            type="text"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="e.g., Wedding, Daily Wear" 
            value={formData.sub_category}
            onChange={(e) => updateField('sub_category')(e.target.value)}
          />
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
          <select 
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            value={formData.color}
            onChange={(e) => updateField('color')(e.target.value)}
          >
            <option value="">Select Color</option>
            {colors.map(color => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
        </div>

        {/* Style */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
          <select 
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            value={formData.style}
            onChange={(e) => updateField('style')(e.target.value)}
          >
            <option value="">Select Style</option>
            {styles.map(style => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
        </div>

        {/* Brand */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
          <input 
            type="text"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="Brand name" 
            value={formData.brand}
            onChange={(e) => updateField('brand')(e.target.value)}
          />
        </div>

        {/* Gemstones */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Gemstones</label>
          <input 
            type="text"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="e.g., Diamond, Ruby, Emerald (separate multiple with commas)" 
            value={formData.gemstones}
            onChange={(e) => updateField('gemstones')(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Common options: {commonGemstones.join(', ')}</p>
        </div>

        {/* Tags */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <input 
            type="text"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="e.g., luxury, handcrafted, antique (separate multiple with commas)" 
            value={formData.tags}
            onChange={(e) => updateField('tags')(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea 
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            rows={3}
            placeholder="Brief description of the jewelry item..." 
            value={formData.description}
            onChange={(e) => updateField('description')(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button 
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isEdit ? 'Update Item' : 'Add Item'}
        </button>
      </div>
    </form>
  );
};
