
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product } from '../types';
import { PRODUCTS as DEFAULT_PRODUCTS, DEFAULT_SECTIONS } from '../constants';
import { db } from '../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';

interface ProductContextType {
  products: Product[];
  sections: string[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addSection: (name: string) => void;
  deleteSection: (name: string) => void;
  loading: boolean;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(true);

  // Sync with Firestore on load
  useEffect(() => {
    const syncData = async () => {
      try {
        // Read local storage backups to migrate if Firestore is empty
        let localSections: string[] = [];
        try {
          const saved = localStorage.getItem('shop_sections');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localSections = parsed;
            }
          }
        } catch (e) {
          console.warn("Could not read local sections", e);
        }

        let localProducts: Product[] = [];
        try {
          const saved = localStorage.getItem('shop_products');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localProducts = parsed;
            }
          }
        } catch (e) {
          console.warn("Could not read local products", e);
        }

        // 1. Fetch & Sync Sections
        const sectionsCol = collection(db, 'sections');
        const sectionsSnapshot = await getDocs(sectionsCol);
        let currentSections: string[] = [];

        if (sectionsSnapshot.empty) {
          const sectionsToSeed = localSections.length > 0 ? localSections : DEFAULT_SECTIONS;
          console.log("Seeding sections to Firestore:", sectionsToSeed);
          for (const sec of sectionsToSeed) {
            await setDoc(doc(db, 'sections', sec), { id: sec, name: sec });
          }
          currentSections = sectionsToSeed;
        } else {
          currentSections = sectionsSnapshot.docs.map(doc => doc.data().name as string);
        }
        setSections(currentSections);

        // 2. Fetch & Sync Products
        const productsCol = collection(db, 'products');
        const productsSnapshot = await getDocs(productsCol);
        let currentProducts: Product[] = [];

        if (productsSnapshot.empty) {
          const productsToSeed = localProducts.length > 0 ? localProducts : DEFAULT_PRODUCTS;
          console.log("Seeding products to Firestore:", productsToSeed);
          for (const prod of productsToSeed) {
            await setDoc(doc(db, 'products', prod.id), prod);
          }
          currentProducts = productsToSeed;
        } else {
          currentProducts = productsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              category: data.category,
              sections: data.sections || [],
              description: data.description || '',
              prices: data.prices || {},
              images: data.images || [],
              paymentTier: data.paymentTier || 'standard'
            } as Product;
          });
        }
        setProducts(currentProducts);
      } catch (err) {
        console.error("Firestore loading error, falling back to local defaults:", err);
      } finally {
        setLoading(false);
      }
    };

    syncData();
  }, []);

  const addProduct = async (product: Product) => {
    try {
      setProducts(prev => {
        if (prev.some(p => p.id === product.id)) return prev;
        return [...prev, product];
      });
      await setDoc(doc(db, 'products', product.id), product);
    } catch (err) {
      console.error("Error adding product to Firestore:", err);
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    try {
      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      await setDoc(doc(db, 'products', updatedProduct.id), updatedProduct);
    } catch (err) {
      console.error("Error updating product in Firestore:", err);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      setProducts(prev => prev.filter(p => p.id !== id));
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      console.error("Error deleting product from Firestore:", err);
    }
  };

  const addSection = async (name: string) => {
    try {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (!sections.includes(trimmed)) {
        setSections(prev => [...prev, trimmed]);
        await setDoc(doc(db, 'sections', trimmed), { id: trimmed, name: trimmed });
      }
    } catch (err) {
      console.error("Error adding section to Firestore:", err);
    }
  };

  const deleteSection = async (name: string) => {
    try {
      setSections(prev => prev.filter(s => s !== name));
      await deleteDoc(doc(db, 'sections', name));
    } catch (err) {
      console.error("Error deleting section from Firestore:", err);
    }
  };

  return (
    <ProductContext.Provider value={{ 
      products, 
      sections,
      addProduct, 
      updateProduct, 
      deleteProduct,
      addSection,
      deleteSection,
      loading
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};
