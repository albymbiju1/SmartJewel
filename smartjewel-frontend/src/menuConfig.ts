export type MenuColumn = { title: string; items: { label: string; href?: string }[] };
export type MenuPromo = { image: string; title: string; cta: string; href: string };
export type MenuData = { columns: MenuColumn[]; promo?: MenuPromo };

export const NAV_TABS: { label: string; key: string }[] = [
  { label: 'All Jewellery', key: 'all' },
  { label: 'Gold', key: 'gold' },
  { label: 'Diamond', key: 'diamond' },
  { label: 'Wedding', key: 'wedding' },
  { label: 'Collections', key: 'collections' },
  { label: 'Gifting', key: 'gifting' },
];

const byPrice: MenuColumn = {
  title: 'Shop by Price',
  items: [
    { label: 'Under ₹25,000' },
    { label: '₹25,000 - ₹50,000' },
    { label: '₹50,000 - ₹1,00,000' },
    { label: '₹1,00,000 & above' },
  ],
};

export const MENU: Record<string, MenuData> = {
  all: {
    columns: [
      {
        title: 'Shop by Category',
        items: [
          { label: 'Earrings' },
          { label: 'Pendants' },
          { label: 'Finger Rings' },
          { label: 'Mangalsutra' },
          { label: 'Chains' },
          { label: 'Nose Pin' },
          { label: 'Necklaces' },
          { label: 'Necklace Set' },
          { label: 'Bangles' },
          { label: 'Bracelets' },
          { label: 'Pendants & Earring Set' },
          { label: 'Toe Rings' },
          { label: 'Anklets' },
          { label: 'Coins' },
        ],
      },
      {
        title: 'Shop by Metal',
        items: [
          { label: 'Gold' },
          { label: 'Diamond' },
        ],
      },
      byPrice,
    ],
    promo: { image: '/Slide1.jpg', title: 'New Arrivals', cta: 'Shop Now', href: '#' },
  },
  gold: {
    columns: [
      {
        title: 'Shop by Category',
        items: [
          { label: 'Necklaces', href: '/products?category=necklaces' },
          { label: 'Rings', href: '/products?category=rings' },
          { label: 'Bangles', href: '/products?category=bangles' },
          { label: 'Chains', href: '/products?category=chains' },
          { label: 'Pendants', href: '/products?category=pendants' },
          { label: 'Earrings', href: '/products?category=earrings' },
          { label: 'Necklace Set', href: '/products?category=necklace-set' },
          { label: 'Bracelets', href: '/products?category=bracelets' },
          { label: 'Nose Pin', href: '/products?category=nose-pin' },
          { label: 'Mangalsutra', href: '/products?category=mangalsutra' },
        ],
      },
      { title: 'Shop by Purity', items: [{ label: '22KT' }, { label: '18KT' }, { label: '14KT' }] },
      { title: 'Metal Colour', items: [{ label: 'Yellow Gold' }, { label: 'Rose Gold' }, { label: 'White Gold' }] },
    ],
    promo: { image: '/Slide2.jpg', title: 'Pure Gold Collection', cta: 'View Collection', href: '/products/gold' },
  },
  diamond: {
    columns: [
      {
        title: 'Shop by Category',
        items: [
          { label: 'Rings' },
          { label: 'Earrings' },
          { label: 'Pendants' },
          { label: 'Bracelets' },
          { label: 'Necklaces' },
          { label: 'Necklace Set' },
          { label: 'Solitaire' },
        ],
      },
      { title: 'Earrings Types', items: [
        { label: 'All Earrings' }, { label: 'Drop & Danglers' }, { label: 'Hoop & Huggies' }, { label: 'Studs & Tops' }
      ] },
      { title: 'Occasion', items: [{ label: 'Everyday' }, { label: 'Office' }, { label: 'Festive' }, { label: 'Wedding' }] },
    ],
    promo: { image: '/Slide3.jpg', title: 'Dazzling Diamonds', cta: 'Discover', href: '#' },
  },
  wedding: {
    columns: [
      { title: 'For Her', items: [{ label: 'Mangalsutra' }, { label: 'Bridal Sets' }, { label: 'Necklaces' }, { label: 'Earrings' }, { label: 'Bangles' }] },
      { title: 'For Him', items: [{ label: 'Rings' }, { label: 'Chains' }, { label: 'Bracelets' }] },
      { title: 'Shop by Style', items: [{ label: 'Traditional' }, { label: 'Temple' }, { label: 'Contemporary' }] },
    ],
    promo: { image: '/Slide1.jpg', title: 'Wedding Edit', cta: 'Explore', href: '#' },
  },

  collections: {
    columns: [
      { title: 'Trending', items: [{ label: 'New Arrivals' }, { label: 'Best Sellers' }] },
      { title: 'Themes', items: [{ label: 'Minimal' }, { label: 'Heritage' }, { label: 'Statement' }] },
      byPrice,
    ],
    promo: { image: '/Slide3.jpg', title: 'Signature Collections', cta: 'See All', href: '#' },
  },
  gifting: {
    columns: [
      { title: 'By Occasion', items: [{ label: 'Birthday' }, { label: 'Anniversary' }, { label: 'Festive' }, { label: 'Wedding' }] },
      { title: 'By Budget', items: [{ label: 'Under ₹10,000' }, { label: '₹10,000 - ₹25,000' }, { label: '₹25,000 - ₹50,000' }, { label: '₹50,000+' }] },
      { title: 'For', items: [{ label: 'Women' }, { label: 'Men' }, { label: 'Kids' }] },
    ],
    promo: { image: '/Slide1.jpg', title: 'Gifts They’ll Treasure', cta: 'Find Gifts', href: '#' },
  },
};

