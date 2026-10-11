import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  UtensilsCrossed,
  Layers,
  Image,
  DollarSign,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Category, Ingredient, Product, RecipeItem } from '../../types';
import { deleteFromStore, getAllFromStore, onDBChange, putToStore } from '../../services/db';
import { formatRupiah, generateUUID } from '../../utils/format';
import { useApp } from '../../context/AppContext';

export const ProductsModule: React.FC = () => {
  const { showToast, activeUser } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Product Form Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);

  // Category Manager Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const loadData = async () => {
    const [p, c, ing] = await Promise.all([
      getAllFromStore<Product>('products'),
      getAllFromStore<Category>('categories'),
      getAllFromStore<Ingredient>('ingredients'),
    ]);
    setProducts(p.sort((a, b) => a.name.localeCompare(b.name)));
    setCategories(c.sort((a, b) => a.sortOrder - b.sortOrder));
    setIngredients(ing);
  };

  useEffect(() => {
    loadData();
    const unsub = onDBChange(() => loadData());
    return unsub;
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setPrice(20000);
    setDescription('');
    setImageUrl('https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=500&q=80');
    setIsAvailable(true);
    setRecipe([]);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCategoryId(p.categoryId);
    setPrice(p.price);
    setDescription(p.description || '');
    setImageUrl(p.image || '');
    setIsAvailable(p.isAvailable);
    setRecipe(p.recipe || []);
    setIsModalOpen(true);
  };

  // Recipe helpers
  const addRecipeItem = () => {
    if (ingredients.length === 0) return;
    setRecipe([...recipe, { ingredientId: ingredients[0].id, quantity: 10 }]);
  };

  const updateRecipeItem = (index: number, ingredientId: string, quantity: number) => {
    const updated = [...recipe];
    updated[index] = { ingredientId, quantity: Math.max(0, quantity) };
    setRecipe(updated);
  };

  const removeRecipeItem = (index: number) => {
    setRecipe(recipe.filter((_, i) => i !== index));
  };

  // Calculate estimated recipe cost
  const estimatedCost = recipe.reduce((sum, item) => {
    const ing = ingredients.find((i) => i.id === item.ingredientId);
    return sum + (ing ? ing.costPerUnit * item.quantity : 0);
  }, 0);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama produk wajib diisi.', 'warning');
      return;
    }
    if (price <= 0) {
      showToast('Harga jual harus lebih dari Rp 0.', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const productData: Product = {
      id: editingProduct ? editingProduct.id : 'prd_' + generateUUID(),
      name: name.trim(),
      categoryId: categoryId || (categories[0]?.id ?? 'cat_coffee'),
      price,
      costPrice: Math.round(estimatedCost),
      description: description.trim(),
      image: imageUrl.trim() || undefined,
      isAvailable,
      recipe,
      variations: editingProduct?.variations || [
        {
          name: 'Ukuran',
          options: [
            { id: 'reg', name: 'Regular', priceDelta: 0 },
            { id: 'lrg', name: 'Large (+Rp 4.000)', priceDelta: 4000 },
          ],
        },
      ],
      modifiers: editingProduct?.modifiers || [
        { name: 'Gula', options: ['Normal', 'Less Sugar', 'No Sugar'] },
      ],
      createdAt: editingProduct ? editingProduct.createdAt : now,
      updatedAt: now,
    };

    await putToStore('products', productData);
    showToast(`Produk "${productData.name}" berhasil disimpan.`, 'success');
    setIsModalOpen(false);
  };

  const handleToggleAvailability = async (p: Product) => {
    const updated = { ...p, isAvailable: !p.isAvailable, updatedAt: new Date().toISOString() };
    await putToStore('products', updated);
    showToast(`Status "${p.name}" diubah menjadi ${updated.isAvailable ? 'Aktif' : 'Non-aktif'}.`, 'info');
  };

  const handleDeleteProduct = async (p: Product) => {
    if (activeUser?.role === 'cashier') {
      showToast('Akses ditolak: Kasir tidak dapat menghapus produk.', 'warning');
      return;
    }
    if (window.confirm(`Hapus produk "${p.name}" secara permanen?`)) {
      await deleteFromStore('products', p.id);
      showToast(`Produk "${p.name}" telah dihapus.`, 'success');
    }
  };

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const newCat: Category = {
      id: 'cat_' + Date.now(),
      name: newCategoryName.trim(),
      sortOrder: categories.length + 1,
    };
    await putToStore('categories', newCat);
    setNewCategoryName('');
    showToast(`Kategori "${newCat.name}" berhasil ditambahkan.`, 'success');
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (window.confirm(`Hapus kategori "${catName}"?`)) {
      await deleteFromStore('categories', catId);
      showToast(`Kategori "${catName}" dihapus.`, 'info');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Produk & Menu Kafe
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kelola daftar menu, formula resep bahan baku, harga jual, dan status ketersediaan.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Kelola Kategori</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Menu Baru</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === c.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.name} ({products.filter((p) => p.categoryId === c.id).length})
            </button>
          ))}
        </div>
      </div>

      {/* Product Cards Table / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProducts.map((p) => {
          const cat = categories.find((c) => c.id === p.categoryId);
          const profit = p.price - (p.costPrice || 0);
          const margin = p.price > 0 ? Math.round((profit / p.price) * 100) : 0;

          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl border p-4 shadow-xs transition flex flex-col justify-between space-y-3 ${
                p.isAvailable ? 'border-slate-200' : 'border-slate-200 bg-slate-50/60 opacity-80'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <UtensilsCrossed className="w-6 h-6" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-1.5 py-0.2 rounded">
                      {cat?.name || 'Kategori'}
                    </span>
                    <button
                      onClick={() => handleToggleAvailability(p)}
                      title="Klik untuk mengubah ketersediaan"
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        p.isAvailable
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {p.isAvailable ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{p.isAvailable ? 'Tersedia' : 'Arsip / Habis'}</span>
                    </button>
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900 mt-1 truncate">{p.name}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{p.description || '-'}</p>
                </div>
              </div>

              {/* Recipe breakdown preview */}
              <div className="p-2.5 rounded-xl bg-slate-50 text-[11px] space-y-1 border border-slate-100">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Resep Bahan:</span>
                  <span>{p.recipe?.length || 0} bahan baku</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-900">Harga Jual: {formatRupiah(p.price)}</span>
                  <span className="text-slate-500">HPP: {formatRupiah(p.costPrice || 0)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                  <span>Margin Kotor: {formatRupiah(profit)}</span>
                  <span>({margin}%)</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(p)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Menu & Resep</span>
                </button>

                <button
                  onClick={() => handleDeleteProduct(p)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  title="Hapus Menu"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Add / Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingProduct ? 'Edit Menu & Resep Bahan Baku' : 'Tambah Menu Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Produk / Minuman:</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kopi Susu Aren"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori:</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Harga Jual Konsumen (Rp):</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">URL Gambar (Foto Produk):</label>
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deskripsi Singkat:</label>
                <input
                  type="text"
                  placeholder="Kombinasi espresso arabika, fresh milk, dan gula aren premium..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* RECIPE INGREDIENTS CONFIGURATION */}
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Formula Resep Bahan Baku per 1 Porsi
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Bahan baku ini akan otomatis dipotong dari stok saat pesanan POS berhasil diselesaikan.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addRecipeItem}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Bahan</span>
                  </button>
                </div>

                {recipe.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs italic bg-white rounded-xl border border-slate-200">
                    Belum ada bahan baku yang dihubungkan ke menu ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recipe.map((rec, idx) => {
                      const ing = ingredients.find((i) => i.id === rec.ingredientId);
                      const cost = ing ? ing.costPerUnit * rec.quantity : 0;

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200"
                        >
                          <select
                            value={rec.ingredientId}
                            onChange={(e) => updateRecipeItem(idx, e.target.value, rec.quantity)}
                            className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            {ingredients.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({i.unit})
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1 w-32">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={rec.quantity}
                              onChange={(e) =>
                                updateRecipeItem(idx, rec.ingredientId, Number(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-right"
                            />
                            <span className="text-slate-500 text-[10px] shrink-0 font-medium">
                              {ing?.unit || 'unit'}
                            </span>
                          </div>

                          <div className="w-24 text-right text-[11px] font-bold text-slate-700">
                            {formatRupiah(cost)}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeRecipeItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-amber-200 text-xs font-bold">
                  <span className="text-slate-700">Estimasi Total HPP Bahan:</span>
                  <span className="text-amber-800 text-sm font-extrabold">{formatRupiah(estimatedCost)}</span>
                </div>
              </div>

              {/* Availability checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="availCheck"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="availCheck" className="text-slate-700 font-semibold">
                  Tampilkan menu ini di Kasir POS (Tersedia untuk dijual)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                >
                  Simpan Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manage Categories */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">Kelola Kategori Menu</h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                placeholder="Nama kategori baru..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs"
              >
                Tambah
              </button>
            </form>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <span className="font-bold text-slate-800">{c.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(c.id, c.name)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 font-bold text-xs text-slate-700"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
