
import React, { useState, useEffect } from 'react';
import { useProducts } from '../context/ProductContext';
import { Product, PaymentTier, Category } from '../types';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

// Simple ID generator if uuid isn't available in environment
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function AdminPage() {
  const { products, sections, addProduct, updateProduct, deleteProduct, addSection, deleteSection, loading } = useProducts();
  
  // --- SIMPLE LOCK STATES ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);

  const [showPasscodeForm, setShowPasscodeForm] = useState(false);
  const [oldPasscode, setOldPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [passcodeMessage, setPasscodeMessage] = useState('');
  const [isUpdatingPasscode, setIsUpdatingPasscode] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // State for new section input
  const [newSectionName, setNewSectionName] = useState('');

  const emptyProduct: Product = {
    id: '',
    name: '',
    category: 'Cake',
    sections: [],
    description: '',
    prices: { '0.5kg': 0, '1kg': 0 },
    images: [''],
    paymentTier: 'standard'
  };

  const [formData, setFormData] = useState<Product>(emptyProduct);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  const handleGenerateDescription = async () => {
    if (!formData.name) {
      alert("Please enter a product name first.");
      return;
    }
    setIsGeneratingDesc(true);
    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey) {
        alert("VITE_API_KEY environment variable is missing.");
        setIsGeneratingDesc(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Write a short, appetizing, and appealing product description (2-3 sentences) for a bakery item. Name: ${formData.name || 'Unknown item'}. Category: ${formData.category || 'Bakery'}.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      if (response.text) {
        setFormData(prev => ({ ...prev, description: response.text }));
      } else {
        alert("Failed to generate description");
      }
    } catch (err: any) {
      console.log("Gemini API Error:", err);
      const errMsg = err.message || JSON.stringify(err);
      if (errMsg.includes("403") || errMsg.includes("PERMISSION_DENIED")) {
        alert("Permission Denied (403): The Gemini API key provided is either restricted (e.g., to Vercel domains) and cannot be used from this preview, or it lacks the Generative Language API permissions.");
      } else {
        alert("Failed to generate description. Check your API key and network.");
      }
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingLogin(true);
    setLoginError('');
    try {
      const docRef = doc(db, 'admin_config', 'auth');
      const docSnap = await getDoc(docRef);
      let validPasscode = 'admin123';
      
      if (docSnap.exists() && docSnap.data().passcode) {
        validPasscode = docSnap.data().passcode;
      } else {
        await setDoc(docRef, { passcode: 'admin123' }, { merge: true });
      }

      if (passcode === validPasscode) {
        setIsAuthenticated(true);
      } else {
        setLoginError('Incorrect passcode.');
      }
    } catch (err) {
      console.error("Login verification failed:", err);
      setLoginError('Failed to verify passcode. Please check connection.');
    } finally {
      setIsCheckingLogin(false);
    }
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasscode !== confirmPasscode) {
      setPasscodeMessage('Error: New passcodes do not match.');
      return;
    }
    if (newPasscode.length < 4) {
      setPasscodeMessage('Error: Passcode must be at least 4 characters.');
      return;
    }
    
    setIsUpdatingPasscode(true);
    setPasscodeMessage('');
    try {
      const docRef = doc(db, 'admin_config', 'auth');
      const docSnap = await getDoc(docRef);
      let validPasscode = 'admin123';
      
      if (docSnap.exists() && docSnap.data().passcode) {
        validPasscode = docSnap.data().passcode;
      }
      
      if (oldPasscode !== validPasscode) {
        setPasscodeMessage('Error: Old passcode is incorrect.');
        setIsUpdatingPasscode(false);
        return;
      }

      await setDoc(docRef, { passcode: newPasscode }, { merge: true });
      setPasscodeMessage('Success: Passcode updated successfully!');
      
      setTimeout(() => {
        setPasscodeMessage('');
        setOldPasscode('');
        setNewPasscode('');
        setConfirmPasscode('');
        setShowPasscodeForm(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      setPasscodeMessage('Error: Failed to update passcode.');
    } finally {
      setIsUpdatingPasscode(false);
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setPasscode('');
  };

  // --- IMAGE LOGIC ---
  const processImageLink = (url: string) => {
    // Regex for standard drive.google.com/file/d/... links
    const driveRegex = /\/d\/([^/]+)/;
    const match = url.match(driveRegex);
    
    // Regex for drive.google.com/open?id=... links
    const idRegex = /id=([^&]+)/;
    const matchId = url.match(idRegex);

    let fileId = '';
    if (match && match[1]) {
      fileId = match[1];
    } else if (matchId && matchId[1]) {
      fileId = matchId[1];
    }

    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    return url;
  };

  const handleAddImageField = () => {
    setFormData(prev => ({ ...prev, images: [...prev.images, ''] }));
  };

  const handleImageChange = (index: number, val: string) => {
    const newImages = [...formData.images];
    newImages[index] = processImageLink(val);
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const handleRemoveImageField = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, images: newImages.length ? newImages : [''] }));
  };

  // --- SECTION MANAGEMENT LOGIC ---
  const handleAddSection = () => {
    if (newSectionName.trim()) {
      addSection(newSectionName.trim());
      setNewSectionName('');
    }
  };

  const handleDeleteSection = (sectionName: string) => {
    if (window.confirm(`Delete collection "${sectionName}"? Products tagged with this will no longer appear in this collection.`)) {
      deleteSection(sectionName);
    }
  };

  // --- CRUD LOGIC ---
  const handleEdit = (product: Product) => {
    setFormData(product);
    setIsEditing(true);
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      deleteProduct(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const processedImages = formData.images.filter(img => img.trim() !== '');

    const productToSave = {
      ...formData,
      images: processedImages.length > 0 ? processedImages : ['https://placehold.co/600x600?text=No+Image']
    };

    if (isEditing) {
      updateProduct(productToSave);
    } else {
      addProduct({ ...productToSave, id: generateId() });
    }

    setShowForm(false);
    setIsEditing(false);
    setFormData(emptyProduct);
  };

  const toggleProductSection = (section: string) => {
    if (formData.sections.includes(section)) {
      setFormData({ ...formData, sections: formData.sections.filter(s => s !== section) });
    } else {
      setFormData({ ...formData, sections: [...formData.sections, section] });
    }
  };

  // --- RENDER LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 animate-pop-in">
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-pink-100 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-shield-halved text-pink-500 text-2xl"></i>
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2 font-serif">Admin Access</h2>
          <p className="text-gray-400 text-sm mb-6">Enter passcode to manage the store</p>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Passcode</label>
              <input 
                type="password" 
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-pink-500 outline-none text-sm text-center tracking-widest"
                placeholder="••••••••"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={isCheckingLogin}
              className="w-full py-3 bg-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-200 active:scale-95 transition-all hover:bg-pink-600 disabled:opacity-50"
            >
              {isCheckingLogin ? 'Verifying...' : 'Sign In'}
            </button>
          </form>

          {loginError && (
            <p className="text-red-500 text-xs font-bold mt-4 leading-relaxed bg-red-50 p-3 rounded-lg border border-red-100">
              {loginError}
            </p>
          )}
          
          <Link to="/" className="block mt-6 text-gray-400 text-xs hover:text-pink-500 text-center">
            <i className="fas fa-arrow-left mr-1"></i> Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  // --- RENDER SYNCING SCREEN ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 animate-pop-in">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm font-bold">Synchronizing with Cloud Firestore...</p>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  return (
    <div className="p-4 max-w-4xl mx-auto animate-fade-in-up pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 mt-4 gap-4 bg-white p-4 rounded-2xl border border-pink-50 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold">
            A
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 font-serif">
              Store Admin
            </h1>
          </div>
        </div>
        <div className="flex space-x-2 self-end md:self-auto">
            <button 
                onClick={() => {
                setFormData(emptyProduct);
                setIsEditing(false);
                setShowForm(!showForm);
                setShowPasscodeForm(false);
                }} 
                className="bg-pink-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-pink-200 active:scale-95 transition-all text-xs"
            >
                {showForm ? 'Cancel' : '+ Add Product'}
            </button>
            <button 
                onClick={() => {
                  setShowPasscodeForm(!showPasscodeForm);
                  setShowForm(false);
                  setPasscodeMessage('');
                  setOldPasscode('');
                  setNewPasscode('');
                  setConfirmPasscode('');
                }}
                className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold active:scale-95 transition-all text-xs border border-gray-700 hover:bg-gray-900"
            >
                <i className="fas fa-key mr-1"></i> {showPasscodeForm ? 'Close' : 'Passcode'}
            </button>
            <button 
                onClick={handleSignOut}
                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-xl font-bold active:scale-95 transition-all text-xs border border-gray-200"
            >
                Sign Out
            </button>
        </div>
      </div>

      {/* --- MANAGE SECTIONS PANEL --- */}
      {!showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-pink-50 mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 font-serif">Manage Collections</h3>
          <p className="text-xs text-gray-500 mb-4">Create new categories (e.g., "Wedding Cakes") to display on the Home page.</p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {sections.map(section => (
              <div key={section} className="flex items-center bg-gray-50 border border-gray-200 rounded-full pl-3 pr-1 py-1">
                <span className="text-xs font-bold text-gray-600 mr-2">{section}</span>
                <button 
                  onClick={() => handleDeleteSection(section)}
                  className="w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200"
                >
                  <i className="fas fa-times text-[10px]"></i>
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="New Collection Name"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              className="flex-grow p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none focus:border-pink-400"
            />
            <button 
              onClick={handleAddSection}
              disabled={!newSectionName.trim()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold disabled:opacity-50"
            >
              Add Collection
            </button>
          </div>
        </div>
      )}

      {/* --- CHANGE PASSCODE PANEL --- */}
      {showPasscodeForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8 animate-pop-in">
          <h3 className="text-lg font-bold text-gray-800 mb-4 font-serif">Change Admin Passcode</h3>
          
          <form onSubmit={handleChangePasscode} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Old Passcode</label>
              <input 
                type="password" 
                placeholder="Current passcode"
                value={oldPasscode}
                onChange={e => setOldPasscode(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-pink-400 tracking-widest"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">New Passcode</label>
                <input 
                  type="password" 
                  placeholder="New passcode"
                  value={newPasscode}
                  onChange={e => setNewPasscode(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-pink-400 tracking-widest"
                  required
                  minLength={4}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Confirm Passcode</label>
                <input 
                  type="password" 
                  placeholder="Confirm new passcode"
                  value={confirmPasscode}
                  onChange={e => setConfirmPasscode(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-pink-400 tracking-widest"
                  required
                  minLength={4}
                />
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={isUpdatingPasscode}
              className="w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-gray-800 transition-all active:scale-95"
            >
              {isUpdatingPasscode ? 'Updating...' : 'Update Passcode'}
            </button>
          </form>
          {passcodeMessage && (
            <p className={`text-xs font-bold mt-4 p-3 rounded-lg border ${passcodeMessage.includes('Success') ? 'text-green-600 bg-green-50 border-green-100' : 'text-red-500 bg-red-50 border-red-100'}`}>
              {passcodeMessage}
            </p>
          )}
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-pink-100 mb-10 animate-pop-in">
          <h2 className="text-xl font-bold text-gray-800 mb-6 font-serif">
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Product Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-pink-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Category</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value as Category})}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-pink-500 outline-none"
                >
                  <option value="Cake">Cake</option>
                  <option value="Confectionery">Confectionery</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Description</label>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingDesc || !formData.name}
                  className="text-xs bg-pink-100 text-pink-600 px-2 py-1 rounded-md font-bold hover:bg-pink-200 transition-colors disabled:opacity-50 flex items-center"
                >
                  <i className={`fas fa-magic mr-1 ${isGeneratingDesc ? 'animate-pulse' : ''}`}></i>
                  {isGeneratingDesc ? 'Generating...' : 'Auto Generate'}
                </button>
              </div>
              <textarea 
                required
                rows={3}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-pink-500 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {formData.category === 'Cake' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Price (0.5kg)</label>
                    <input 
                      type="number" 
                      value={formData.prices['0.5kg'] || ''}
                      onChange={e => setFormData({...formData, prices: {...formData.prices, '0.5kg': Number(e.target.value)}})}
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-pink-500 outline-none"
                      placeholder="₹"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Price (1kg)</label>
                    <input 
                      type="number" 
                      value={formData.prices['1kg'] || ''}
                      onChange={e => setFormData({...formData, prices: {...formData.prices, '1kg': Number(e.target.value)}})}
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-pink-500 outline-none"
                      placeholder="₹"
                    />
                  </div>
                </>
              ) : (
                 <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Price (Piece)</label>
                    <input 
                      type="number" 
                      value={formData.prices['piece'] || ''}
                      onChange={e => setFormData({...formData, prices: {...formData.prices, 'piece': Number(e.target.value)}})}
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-pink-500 outline-none"
                      placeholder="₹"
                    />
                  </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Tier</label>
                <select 
                  value={formData.paymentTier}
                  onChange={e => setFormData({...formData, paymentTier: e.target.value as PaymentTier})}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-pink-500 outline-none"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sections (Collections)</label>
              <div className="flex flex-wrap gap-2">
                {sections.map(section => (
                  <button
                    type="button"
                    key={section}
                    onClick={() => toggleProductSection(section)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      formData.sections.includes(section)
                        ? 'bg-pink-500 text-white border-pink-500'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {section}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Manage these tags in the "Manage Collections" panel above.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Product Images</label>
              <div className="bg-blue-50 p-3 rounded-lg mb-4 text-xs text-blue-800 border border-blue-100">
                <strong>Tip:</strong> Paste a Google Drive share link, and we'll automatically convert it for the app.
                Ensure the file in Drive is set to <strong>"Anyone with the link can view"</strong>.
              </div>
              
              {formData.images.map((img, idx) => (
                <div key={idx} className="mb-4">
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      value={img}
                      onChange={e => handleImageChange(idx, e.target.value)}
                      className="flex-grow p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-pink-500 outline-none"
                      placeholder="Image URL (Paste Drive Link Here)"
                    />
                    <button 
                      type="button" 
                      onClick={() => handleRemoveImageField(idx)}
                      className="p-3 text-red-400 hover:text-red-600 font-bold"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                  {/* Image Preview for Admin */}
                  {img && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                      <img 
                        src={img} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => e.currentTarget.src = 'https://placehold.co/100x100?text=Error'}
                      />
                    </div>
                  )}
                </div>
              ))}
              <button 
                type="button" 
                onClick={handleAddImageField}
                className="text-pink-500 text-xs font-bold uppercase tracking-wider hover:text-pink-600"
              >
                + Add Another Image
              </button>
            </div>

            <button type="submit" className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all">
              {isEditing ? 'Save Changes' : 'Create Product'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {products.map(product => (
          <div key={product.id} className="bg-white p-4 rounded-xl border border-pink-50 flex items-center space-x-4 shadow-sm hover:shadow-md transition-shadow">
            <img 
                src={product.images[0]} 
                alt={product.name} 
                className="w-16 h-16 rounded-lg object-cover bg-gray-100" 
                referrerPolicy="no-referrer"
                onError={(e) => e.currentTarget.src = 'https://placehold.co/100x100?text=No+Img'}
            />
            <div className="flex-grow">
              <h3 className="font-bold text-gray-800">{product.name}</h3>
              <p className="text-xs text-gray-500">{product.category} • {product.paymentTier}</p>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => handleEdit(product)}
                className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100"
              >
                <i className="fas fa-edit text-xs"></i>
              </button>
              <button 
                onClick={() => handleDelete(product.id)}
                className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"
              >
                <i className="fas fa-trash text-xs"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
