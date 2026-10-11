import React, { useEffect, useState } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  Printer,
  RotateCcw,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { CartItem, Category, Ingredient, PaymentMethod, PaymentStatus, Product, ProductVariationOption, Sale } from '../../types';
import { getAllFromStore, onDBChange, processSaleTransaction } from '../../services/db';
import { formatRupiah, generateTransactionNumber, generateUUID } from '../../utils/format';
import { useApp } from '../../context/AppContext';
import { QRISPaymentModal } from './QRISPaymentModal';
import { ReceiptModal } from './ReceiptModal';

export const POSModule: React.FC = () => {
  const { settings, activeUser, activeSession, showToast, isOnline, setActiveTab } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');

  // Modals & workflows
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariationOption | undefined>(undefined);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>({});
  const [itemNote, setItemNote] = useState('');

  // Payment workflow
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showQRISModal, setShowQRISModal] = useState(false);
  const [pendingTxNumber, setPendingTxNumber] = useState('');
  const [activeReceiptSaleId, setActiveReceiptSaleId] = useState<string | null>(null);

  // Load products, categories, ingredients
  const loadData = async () => {
    const [p, c, ing] = await Promise.all([
      getAllFromStore<Product>('products'),
      getAllFromStore<Category>('categories'),
      getAllFromStore<Ingredient>('ingredients'),
    ]);
    setProducts(p.filter((prod) => prod.isAvailable));
    setCategories(c.sort((a, b) => a.sortOrder - b.sortOrder));
    setIngredients(ing);
  };

  useEffect(() => {
    loadData();
    const unsub = onDBChange((store) => {
      if (store === 'products' || store === 'ingredients' || store === 'categories' || store === 'all') {
        loadData();
      }
    });
    return unsub;
  }, []);

  // Filtered products
  const filteredProducts = products.filter((prod) => {
    const matchCat = selectedCategory === 'all' || prod.categoryId === selectedCategory;
    const matchSearch =
      !searchQuery ||
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod.description && prod.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  // Calculate stock availability based on product's ingredient recipe
  const getProductStockStatus = (prod: Product): { available: boolean; lowestPortion: number; limitingIngredient?: string } => {
    if (!prod.recipe || prod.recipe.length === 0) {
      return { available: true, lowestPortion: 999 };
    }

    let minPortions = Infinity;
    let limitingName = '';

    for (const rec of prod.recipe) {
      const ing = ingredients.find((i) => i.id === rec.ingredientId);
      if (!ing || ing.currentStock <= 0) {
        return { available: false, lowestPortion: 0, limitingIngredient: ing?.name || 'Bahan baku' };
      }
      const portions = Math.floor(ing.currentStock / rec.quantity);
      if (portions < minPortions) {
        minPortions = portions;
        limitingName = ing.name;
      }
    }

    return {
      available: minPortions > 0,
      lowestPortion: minPortions === Infinity ? 999 : minPortions,
      limitingIngredient: limitingName,
    };
  };

  // Add product to cart
  const handleProductClick = (product: Product) => {
    const status = getProductStockStatus(product);
    if (!status.available) {
      showToast(`Stok bahan baku "${status.limitingIngredient}" habis untuk menu ini.`, 'error');
      return;
    }

    // If product has variations or modifiers, open customization modal
    const hasVariations = product.variations && product.variations.length > 0;
    const hasModifiers = product.modifiers && product.modifiers.length > 0;

    if (hasVariations || hasModifiers) {
      setCustomizingProduct(product);
      setSelectedVariation(product.variations?.[0]?.options?.[0]);
      const initialMods: Record<string, string> = {};
      product.modifiers?.forEach((m) => {
        if (m.options?.length) initialMods[m.name] = m.options[0];
      });
      setSelectedModifiers(initialMods);
      setItemNote('');
      return;
    }

    // Direct add to cart
    addCartItemDirect(product, undefined, {}, '');
  };

  const addCartItemDirect = (
    product: Product,
    variation?: ProductVariationOption,
    modifiers?: Record<string, string>,
    notes?: string
  ) => {
    const priceDelta = variation?.priceDelta || 0;
    const unitPrice = product.price + priceDelta;

    setCart((prev) => {
      // Find matching item with same variation, modifiers, and notes
      const existingIdx = prev.findIndex(
        (item) =>
          item.productId === product.id &&
          item.selectedVariation?.id === variation?.id &&
          JSON.stringify(item.selectedModifiers) === JSON.stringify(modifiers) &&
          item.notes === notes
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + 1;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          subtotal: newQty * unitPrice,
        };
        return updated;
      }

      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        categoryName: categories.find((c) => c.id === product.categoryId)?.name,
        basePrice: product.price,
        unitPrice,
        quantity: 1,
        subtotal: unitPrice,
        selectedVariation: variation,
        selectedModifiers: modifiers,
        notes,
        recipe: product.recipe || [],
      };
      return [...prev, newItem];
    });

    showToast(`"${product.name}" ditambahkan ke keranjang.`, 'info');
  };

  const confirmCustomization = () => {
    if (!customizingProduct) return;
    addCartItemDirect(customizingProduct, selectedVariation, selectedModifiers, itemNote);
    setCustomizingProduct(null);
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }

      updated[index] = {
        ...item,
        quantity: newQty,
        subtotal: newQty * item.unitPrice,
      };
      return updated;
    });
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountPercent(0);
    setCustomerName('');
    setTableNumber('');
  };

  // Totals calculations
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const calculatedDiscount =
    discountType === 'percent'
      ? Math.round((subtotal * discountPercent) / 100)
      : Math.min(subtotal, discountAmount);

  const afterDiscount = Math.max(0, subtotal - calculatedDiscount);
  const taxAmount = Math.round((afterDiscount * (settings.taxPercentage || 0)) / 100);
  const serviceAmount = Math.round((afterDiscount * (settings.servicePercentage || 0)) / 100);
  const finalTotal = afterDiscount + taxAmount + serviceAmount;

  // Change calculation
  const cashChange = Math.max(0, (cashTendered || 0) - finalTotal);

  // Quick cash buttons
  const quickCashOptions = [
    finalTotal,
    Math.ceil(finalTotal / 10000) * 10000,
    Math.ceil(finalTotal / 20000) * 20000,
    Math.ceil(finalTotal / 50000) * 50000,
    Math.ceil(finalTotal / 100000) * 100000,
  ].filter((v, i, arr) => v >= finalTotal && arr.indexOf(v) === i);

  // Trigger Checkout
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      showToast('Keranjang masih kosong.', 'warning');
      return;
    }
    if (!activeSession) {
      showToast('Shift kasir belum dibuka. Silakan buka shift terlebih dahulu di menu Sesi Kasir.', 'warning');
      return;
    }

    setPendingTxNumber(generateTransactionNumber('KD'));
    setPaymentMethod('cash');
    setCashTendered(finalTotal);
    setIsPaymentModalOpen(true);
  };

  // Submit Sale Transaction
  const executeSale = async (method: PaymentMethod, status: PaymentStatus, qrisRef?: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const operationId = generateUUID();
      const txNum = pendingTxNumber || generateTransactionNumber('KD');

      const saleData = {
        transactionNumber: txNum,
        operationId,
        sessionId: activeSession ? activeSession.id : 'no_session',
        cashierId: activeUser ? activeUser.id : 'usr_anon',
        cashierName: activeUser ? activeUser.name : 'Kasir',
        customerName: customerName.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        items: cart,
        subtotal,
        discount: calculatedDiscount,
        taxRate: settings.taxPercentage || 0,
        taxAmount,
        serviceRate: settings.servicePercentage || 0,
        serviceAmount,
        totalAmount: finalTotal,
        paymentMethod: method,
        paymentStatus: status,
        cashTendered: method === 'cash' ? cashTendered : undefined,
        cashChange: method === 'cash' ? cashChange : undefined,
        qrisReference: qrisRef,
        notes: `Transaksi Kasir ${settings.name}`,
        createdAt: new Date().toISOString(),
      };

      const result = await processSaleTransaction(saleData);

      setCompletedSale(result.sale);
      setIsPaymentModalOpen(false);
      setShowQRISModal(false);
      clearCart();

      if (status === 'paid') {
        showToast(`Transaksi ${result.sale.transactionNumber} sukses dibayar & disimpan!`, 'success');
      } else {
        showToast(
          `Transaksi ${result.sale.transactionNumber} disimpan (Menunggu Konfirmasi Pembayaran).`,
          'info'
        );
      }
    } catch (err: any) {
      console.error('Sale error:', err);
      showToast(`Gagal memproses transaksi: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* LEFT: Product Catalog */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 border-r border-slate-200">
        {/* Top Filters & Search */}
        <div className="p-4 bg-white border-b border-slate-200 space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari menu kopi, minuman, makanan, atau snack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Offline indicator badge in catalog */}
            {!isOnline && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                POS Offline Aktif
              </span>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Menu ({products.length})
            </button>
            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <Info className="w-10 h-10 mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">Tidak ada produk yang cocok</p>
              <p className="text-xs text-slate-400 mt-1">Coba kata kunci pencarian lain atau pilih kategori Semua.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((prod) => {
                const stockStatus = getProductStockStatus(prod);
                const hasCustomizations =
                  (prod.variations && prod.variations.length > 0) ||
                  (prod.modifiers && prod.modifiers.length > 0);

                return (
                  <button
                    key={prod.id}
                    onClick={() => handleProductClick(prod)}
                    disabled={!stockStatus.available}
                    className={`group text-left bg-white rounded-2xl border p-3 flex flex-col justify-between transition relative overflow-hidden shadow-xs hover:shadow-md ${
                      !stockStatus.available
                        ? 'opacity-60 border-slate-200 cursor-not-allowed bg-slate-50'
                        : 'border-slate-200 hover:border-amber-400 active:scale-[0.98]'
                    }`}
                  >
                    <div>
                      {/* Product Image / Placeholder */}
                      <div className="w-full h-28 rounded-xl bg-slate-100 mb-2.5 overflow-hidden relative">
                        {prod.image ? (
                          <img
                            src={prod.image}
                            alt={prod.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 bg-amber-50">
                            <Sparkles className="w-6 h-6 text-amber-300" />
                          </div>
                        )}

                        {/* Stock warning pill */}
                        {!stockStatus.available ? (
                          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center p-2">
                            <span className="bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full uppercase">
                              Habis ({stockStatus.limitingIngredient})
                            </span>
                          </div>
                        ) : stockStatus.lowestPortion <= 5 ? (
                          <div className="absolute bottom-1.5 left-1.5 bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.5 rounded">
                            Sisa {stockStatus.lowestPortion} porsi
                          </div>
                        ) : null}

                        {hasCustomizations && (
                          <div className="absolute top-1.5 right-1.5 bg-slate-900/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs">
                            Opsi
                          </div>
                        )}
                      </div>

                      {/* Product Title */}
                      <h4 className="font-bold text-xs text-slate-900 line-clamp-1 group-hover:text-amber-600 transition">
                        {prod.name}
                      </h4>
                      {prod.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {prod.description}
                        </p>
                      )}
                    </div>

                    {/* Price & Action */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <span className="font-extrabold text-xs text-slate-900">
                        {formatRupiah(prod.price)}
                      </span>
                      <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart and Checkout Panel */}
      <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between shrink-0 shadow-lg">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Pesanan Aktif</h3>
              <p className="text-[11px] text-slate-500">{cart.length} jenis item di keranjang</p>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              title="Kosongkan Keranjang"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition text-xs flex items-center gap-1 font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Customer & Table details inputs */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-2 text-xs">
          <input
            type="text"
            placeholder="Nama Pelanggan (opsional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500"
          />
          <input
            type="text"
            placeholder="No. Meja / Takeaway"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <ShoppingCart className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600 text-sm">Keranjang Masih Kosong</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                Pilih menu di sebelah kiri untuk menambahkan pesanan ke keranjang.
              </p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 leading-snug">{item.productName}</h5>
                    {item.selectedVariation && (
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                        {item.selectedVariation.name}
                      </span>
                    )}
                    {item.selectedModifiers && Object.keys(item.selectedModifiers).length > 0 && (
                      <div className="text-[10px] text-slate-500">
                        {Object.values(item.selectedModifiers).join(', ')}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px] text-slate-500 italic mt-0.5">
                        "{item.notes}"
                      </div>
                    )}
                  </div>
                  <span className="font-extrabold text-xs text-slate-900">
                    {formatRupiah(item.subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] text-slate-500">
                    @{formatRupiah(item.unitPrice)}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartQuantity(idx, -1)}
                      className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold text-xs w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(idx, 1)}
                      className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeCartItem(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation & Checkout Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          {/* Discount & Taxes row */}
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium text-slate-800">{formatRupiah(subtotal)}</span>
            </div>

            {/* Discount adjustment */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-slate-500">
                <Tag className="w-3 h-3 text-amber-500" />
                Diskon:
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={discountType === 'percent' ? discountPercent : discountAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    if (discountType === 'percent') setDiscountPercent(val);
                    else setDiscountAmount(val);
                  }}
                  className="w-20 px-2 py-0.5 bg-white border border-slate-200 rounded text-right text-xs"
                />
                <button
                  onClick={() => setDiscountType(discountType === 'fixed' ? 'percent' : 'fixed')}
                  className="px-1.5 py-0.5 bg-slate-200 rounded text-[10px] font-bold"
                >
                  {discountType === 'percent' ? '%' : 'Rp'}
                </button>
                {calculatedDiscount > 0 && (
                  <span className="text-rose-600 font-semibold ml-1">
                    -{formatRupiah(calculatedDiscount)}
                  </span>
                )}
              </div>
            </div>

            {settings.taxPercentage > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Pajak Resto ({settings.taxPercentage}%):</span>
                <span>{formatRupiah(taxAmount)}</span>
              </div>
            )}

            {settings.servicePercentage > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Biaya Layanan ({settings.servicePercentage}%):</span>
                <span>{formatRupiah(serviceAmount)}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-300 font-extrabold text-base text-slate-900">
              <span>TOTAL BAYAR:</span>
              <span className="text-amber-600">{formatRupiah(finalTotal)}</span>
            </div>
          </div>

          {/* Checkout Button */}
          {!activeSession ? (
            <button
              onClick={() => setActiveTab('sessions')}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Clock className="w-4 h-4" />
              <span>Buka Shift Kasir Terlebih Dahulu</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCheckout}
              disabled={cart.length === 0}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-md ${
                cart.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-amber-500/20'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Bayar & Proses Pesanan ({formatRupiah(finalTotal)})</span>
            </button>
          )}
        </div>
      </div>

      {/* MODAL 1: Product Customization (Variations & Modifiers) */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b pb-3 border-slate-200">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {customizingProduct.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Harga dasar: {formatRupiah(customizingProduct.price)}
                </p>
              </div>
              <button
                onClick={() => setCustomizingProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Variations */}
            {customizingProduct.variations?.map((v, vIdx) => (
              <div key={vIdx} className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">{v.name}:</label>
                <div className="grid grid-cols-2 gap-2">
                  {v.options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedVariation(opt)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition ${
                        selectedVariation?.id === opt.id
                          ? 'border-amber-500 bg-amber-50 text-amber-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div>{opt.name}</div>
                      {opt.priceDelta !== 0 && (
                        <div className="text-[10px] text-slate-500">
                          {opt.priceDelta > 0 ? `+${formatRupiah(opt.priceDelta)}` : formatRupiah(opt.priceDelta)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Modifiers */}
            {customizingProduct.modifiers?.map((m, mIdx) => (
              <div key={mIdx} className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">{m.name}:</label>
                <div className="flex flex-wrap gap-1.5">
                  {m.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSelectedModifiers({ ...selectedModifiers, [m.name]: opt })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                        selectedModifiers[m.name] === opt
                          ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Order Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Khusus Barista / Dapur:
              </label>
              <input
                type="text"
                placeholder="Misal: Kurangi es, tanpa sedotan..."
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={confirmCustomization}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-md transition"
            >
              Tambahkan ke Keranjang (
              {formatRupiah(customizingProduct.price + (selectedVariation?.priceDelta || 0))})
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Pembayaran Kasir</h3>
                <p className="text-xs text-slate-500">No. Transaksi: {pendingTxNumber}</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Total Display */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Total Tagihan:</span>
                <div className="text-2xl font-black text-amber-400">{formatRupiah(finalTotal)}</div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Kasir: {activeUser?.name}</div>
                <div>{cart.length} item pesanan</div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Pilih Metode Pembayaran:</label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl text-center border font-semibold text-xs flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'cash'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-5 h-5 text-amber-600" />
                  <span>Tunai (Cash)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('qris')}
                  className={`p-3 rounded-xl text-center border font-semibold text-xs flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'qris'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <QrCode className="w-5 h-5 text-amber-600" />
                  <span>QRIS BI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`p-3 rounded-xl text-center border font-semibold text-xs flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'transfer'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <span>Transfer Bank</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('debit')}
                  className={`p-3 rounded-xl text-center border font-semibold text-xs flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === 'debit'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <span>Kartu Debit</span>
                </button>
              </div>
            </div>

            {/* CASH PAYMENT SECTION */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Uang Diterima dari Pelanggan:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cashTendered || ''}
                    onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                    placeholder="Masukkan nominal uang tunai..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Quick denomination buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {quickCashOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCashTendered(opt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        cashTendered === opt
                          ? 'bg-amber-500 text-slate-950 border-amber-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt === finalTotal ? `Uang Pas (${formatRupiah(opt)})` : formatRupiah(opt)}
                    </button>
                  ))}
                </div>

                {/* Change calculation */}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs text-slate-600">Uang Kembalian:</span>
                  <span
                    className={`font-black text-lg ${
                      cashTendered < finalTotal ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {cashTendered < finalTotal
                      ? `Kurang ${formatRupiah(finalTotal - cashTendered)}`
                      : formatRupiah(cashChange)}
                  </span>
                </div>
              </div>
            )}

            {/* QRIS / TRANSFER / DEBIT NOTICE */}
            {paymentMethod === 'qris' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-amber-700" />
                  Alur Keamanan QRIS Terbuka
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Sesuai kebijakan keselamatan pembayaran, klik tombol <strong>"Tampilkan QRIS"</strong> di bawah untuk membuka kode QR pelanggan dan memverifikasi mutasi bank sebelum menandai lunas.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
              >
                Batal
              </button>

              {paymentMethod === 'qris' ? (
                <button
                  type="button"
                  onClick={() => setShowQRISModal(true)}
                  className="flex-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-md transition"
                >
                  Tampilkan QRIS & Verifikasi
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => executeSale(paymentMethod, 'paid')}
                  disabled={isSubmitting || (paymentMethod === 'cash' && cashTendered < finalTotal)}
                  className={`flex-2 py-3 rounded-xl font-bold text-sm shadow-md transition ${
                    isSubmitting || (paymentMethod === 'cash' && cashTendered < finalTotal)
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                  }`}
                >
                  {isSubmitting ? 'Memproses Transaksi...' : `Selesaikan Pembayaran (${formatRupiah(finalTotal)})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Dedicated QRIS Verification Modal */}
      {showQRISModal && (
        <QRISPaymentModal
          amount={finalTotal}
          transactionNumber={pendingTxNumber}
          onCancel={() => setShowQRISModal(false)}
          onSaveAsAwaitingConfirmation={() => {
            executeSale('qris', 'awaiting_confirmation');
          }}
          onConfirmVerifiedPayment={(refCode) => {
            executeSale('qris', 'paid', refCode);
          }}
        />
      )}

      {/* MODAL 4: Success Screen */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900">Transaksi Berhasil!</h3>
              <p className="text-xs text-slate-500 mt-1">
                No. Transaksi: <strong>{completedSale.transactionNumber}</strong>
              </p>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {formatRupiah(completedSale.totalAmount)}
              </div>
            </div>

            {completedSale.paymentMethod === 'cash' && completedSale.cashChange !== undefined && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500">Uang Kembalian: </span>
                <strong className="text-emerald-700 text-sm">
                  {formatRupiah(completedSale.cashChange)}
                </strong>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              Resep bahan baku telah otomatis terpotong dari stok inventaris tepat 1 kali.
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  setActiveReceiptSaleId(completedSale.id);
                }}
                className="py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Cetak Struk</span>
              </button>

              <button
                onClick={() => setCompletedSale(null)}
                className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Pesanan Baru</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Receipt Modal */}
      {activeReceiptSaleId && (
        <ReceiptModal
          saleId={activeReceiptSaleId}
          onClose={() => setActiveReceiptSaleId(null)}
        />
      )}
    </div>
  );
};
