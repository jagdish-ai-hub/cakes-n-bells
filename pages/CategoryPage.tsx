
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../context/ProductContext';

interface CategoryPageProps {
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
}

const CategoryPage: React.FC<CategoryPageProps> = ({ wishlist, onToggleWishlist }) => {
  const { id } = useParams<{ id: string }>();
  const { products, loading } = useProducts();
  
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-pink-600 text-sm font-bold tracking-wider uppercase">Loading Products...</p>
        </div>
      </div>
    );
  }

  const filteredProducts = products.filter(p => p.category === id);

  return (
    <div className="p-4 animate-slide-in-right">
      <div className="mb-6 flex items-center space-x-2">
        <Link to="/" className="text-gray-400 hover:text-pink-500">Home</Link>
        <span className="text-gray-300">/</span>
        <span className="text-pink-600 font-semibold">{id}</span>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 font-serif">{id}</h1>
        <p className="text-gray-500 mt-2">Explore our exquisite selection of {id?.toLowerCase()}.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredProducts.map(product => (
          <ProductCard 
            key={product.id} 
            product={product}
            isWishlisted={wishlist.includes(product.id)}
            onToggleWishlist={onToggleWishlist}
          />
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-20">
          <i className="fas fa-box-open text-4xl text-gray-200 mb-4"></i>
          <p className="text-gray-400">No products found in this category.</p>
        </div>
      )}
    </div>
  );
};

export default CategoryPage;
