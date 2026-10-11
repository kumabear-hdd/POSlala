import {
  AuditLog,
  CafeSettings,
  CashSession,
  Category,
  Expense,
  Ingredient,
  InventoryMovement,
  Product,
  PurchaseOrder,
  Refund,
  Sale,
  Supplier,
  SyncQueueItem,
  UserProfile,
} from '../types';
import { generateTransactionNumber, generateUUID } from '../utils/format';

const DB_NAME = 'KedaiOS_DB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores if not exist
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cafe_settings')) {
          db.createObjectStore('cafe_settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ingredients')) {
          db.createObjectStore('ingredients', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
          salesStore.createIndex('transactionNumber', 'transactionNumber', { unique: true });
          salesStore.createIndex('operationId', 'operationId', { unique: true });
          salesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          salesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('inventory_movements')) {
          const moveStore = db.createObjectStore('inventory_movements', { keyPath: 'id' });
          moveStore.createIndex('ingredientId', 'ingredientId', { unique: false });
          moveStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('suppliers')) {
          db.createObjectStore('suppliers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('purchase_orders')) {
          const poStore = db.createObjectStore('purchase_orders', { keyPath: 'id' });
          poStore.createIndex('poNumber', 'poNumber', { unique: true });
          poStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('expenses')) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expStore.createIndex('date', 'date', { unique: false });
          expStore.createIndex('category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains('cash_sessions')) {
          const sessStore = db.createObjectStore('cash_sessions', { keyPath: 'id' });
          sessStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('refunds')) {
          const refStore = db.createObjectStore('refunds', { keyPath: 'id' });
          refStore.createIndex('saleId', 'saleId', { unique: false });
        }
        if (!db.objectStoreNames.contains('audit_logs')) {
          const logStore = db.createObjectStore('audit_logs', { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          const qStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          qStore.createIndex('status', 'status', { unique: false });
          qStore.createIndex('operationId', 'operationId', { unique: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

// Event bus for reactive data updates across components
type DBChangeListener = (storeName: string) => void;
const listeners: Set<DBChangeListener> = new Set();

export function onDBChange(listener: DBChangeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyChange(storeName: string) {
  listeners.forEach((l) => l(storeName));
}

// Generic Store Operations
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getFromStore<T>(storeName: string, id: string): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as T) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function putToStore<T>(storeName: string, item: T): Promise<T> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => {
      notifyChange(storeName);
      resolve(item);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => {
      notifyChange(storeName);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => {
      notifyChange(storeName);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function factoryResetDatabase(): Promise<void> {
  const allStores = [
    'cafe_settings',
    'profiles',
    'categories',
    'ingredients',
    'products',
    'sales',
    'inventory_movements',
    'suppliers',
    'purchase_orders',
    'expenses',
    'cash_sessions',
    'refunds',
    'audit_logs',
    'sync_queue',
  ];
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(allStores, 'readwrite');
    allStores.forEach((storeName) => {
      tx.objectStore(storeName).clear();
    });
    tx.oncomplete = () => {
      notifyChange('all');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function resetTransactionsAndShiftsOnly(): Promise<void> {
  const stores = ['sales', 'inventory_movements', 'expenses', 'cash_sessions', 'refunds', 'sync_queue'];
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach((storeName) => {
      tx.objectStore(storeName).clear();
    });
    tx.oncomplete = () => {
      notifyChange('all');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Register Initial Owner Account & Cafe Settings
export async function registerInitialOwner(
  cafeName: string,
  ownerName: string,
  pin: string,
  email: string,
  phone: string
): Promise<{ owner: UserProfile; settings: CafeSettings }> {
  const db = await getDB();
  const tx = db.transaction(['cafe_settings', 'profiles', 'categories', 'audit_logs'], 'readwrite');

  const now = new Date().toISOString();

  const settings: CafeSettings = {
    id: 'default_cafe',
    name: cafeName.trim() || 'POS Lapak',
    tagline: 'Sistem Manajemen Kafe & Kasir Pintar',
    address: 'Alamat Toko / Kafe',
    phone: phone.trim() || '0812-3456-7890',
    email: email.trim() || 'owner@poslapak.id',
    taxPercentage: 10,
    servicePercentage: 0,
    currency: 'IDR',
    receiptFooter: `Terima kasih telah berkunjung ke ${cafeName.trim() || 'POS Lapak'}!\nFollow IG: @poslapak.id`,
    paperWidth: '58mm',
    singleCashierMode: true,
    qrisMerchantName: (cafeName.trim() || 'POS LAPAK INDONESIA').toUpperCase(),
    qrisNmid: 'ID1020304050607',
    autoSyncOnOnline: true,
  };
  tx.objectStore('cafe_settings').put(settings);

  const ownerProfile: UserProfile = {
    id: 'usr_' + generateUUID(),
    name: ownerName.trim(),
    role: 'owner',
    pin: pin.trim(),
    email: email.trim() || 'owner@poslapak.id',
    phone: phone.trim() || '0812-3456-7890',
    active: true,
    createdAt: now,
  };
  tx.objectStore('profiles').put(ownerProfile);

  // Default Categories
  const initialCategories: Category[] = [
    { id: 'cat_coffee', name: 'Espresso & Kopi', sortOrder: 1 },
    { id: 'cat_noncoffee', name: 'Non-Kopi & Teh', sortOrder: 2 },
    { id: 'cat_food', name: 'Makanan & Snack', sortOrder: 3 },
  ];
  initialCategories.forEach((c) => tx.objectStore('categories').put(c));

  const log: AuditLog = {
    id: generateUUID(),
    timestamp: now,
    userName: ownerProfile.name,
    role: 'owner',
    action: 'Pendaftaran Akun Pemilik (Owner)',
    details: `Owner ${ownerProfile.name} berhasil mendaftarkan kafe "${settings.name}".`,
  };
  tx.objectStore('audit_logs').put(log);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      notifyChange('all');
      resolve({ owner: ownerProfile, settings });
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Seed Initial Data (Only Settings & minimal setup, NOT mock products)
export async function seedInitialDataIfNeeded(): Promise<void> {
  const settings = await getAllFromStore<CafeSettings>('cafe_settings');
  if (settings.length > 0) {
    return; // Already initialized
  }

  const db = await getDB();
  const tx = db.transaction(['cafe_settings'], 'readwrite');

  const initialSettings: CafeSettings = {
    id: 'default_cafe',
    name: 'POS Lapak',
    tagline: 'Sistem Manajemen Kafe & Kasir Pintar',
    address: 'Jl. Melawai Raya No. 42, Kebayoran Baru, Jakarta Selatan',
    phone: '0812-3456-7890',
    email: 'kontak@poslapak.id',
    taxPercentage: 10,
    servicePercentage: 0,
    currency: 'IDR',
    receiptFooter: 'Terima kasih telah berkunjung ke POS Lapak!\nFollow IG: @poslapak.id',
    paperWidth: '58mm',
    singleCashierMode: true,
    qrisMerchantName: 'POS LAPAK INDONESIA',
    qrisNmid: 'ID1020304050607',
    autoSyncOnOnline: true,
  };
  tx.objectStore('cafe_settings').put(initialSettings);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      notifyChange('cafe_settings');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Explicit Helper: Seed Sample Coffee Menu Data (Optional, called on demand)
export async function seedSampleMenuData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['categories', 'ingredients', 'products', 'suppliers', 'audit_logs'],
    'readwrite'
  );

  const now = new Date().toISOString();

  // Categories
  const initialCategories: Category[] = [
    { id: 'cat_coffee', name: 'Espresso & Kopi', sortOrder: 1 },
    { id: 'cat_noncoffee', name: 'Non-Kopi & Teh', sortOrder: 2 },
    { id: 'cat_food', name: 'Makanan & Toast', sortOrder: 3 },
    { id: 'cat_snack', name: 'Camilan & Kentang', sortOrder: 4 },
  ];
  initialCategories.forEach((c) => tx.objectStore('categories').put(c));

  // Ingredients
  const initialIngredients: Ingredient[] = [
    { id: 'ing_arabica', name: 'Biji Kopi Arabika Gayo', unit: 'gram', currentStock: 5000, minStock: 1000, costPerUnit: 220, updatedAt: now },
    { id: 'ing_robusta', name: 'Biji Kopi Robusta Lampung', unit: 'gram', currentStock: 4000, minStock: 1000, costPerUnit: 120, updatedAt: now },
    { id: 'ing_freshmilk', name: 'Susu Fresh Milk UHT', unit: 'ml', currentStock: 15000, minStock: 3000, costPerUnit: 20, updatedAt: now },
    { id: 'ing_aren', name: 'Gula Aren Organik Cair', unit: 'ml', currentStock: 5000, minStock: 1000, costPerUnit: 35, updatedAt: now },
    { id: 'ing_matcha', name: 'Bubuk Matcha Uji Premium', unit: 'gram', currentStock: 1200, minStock: 250, costPerUnit: 350, updatedAt: now },
    { id: 'ing_cokelat', name: 'Cokelat Batavia Murni', unit: 'gram', currentStock: 2500, minStock: 500, costPerUnit: 150, updatedAt: now },
    { id: 'ing_tea', name: 'Daun Teh Melati Artisan', unit: 'gram', currentStock: 2000, minStock: 300, costPerUnit: 60, updatedAt: now },
    { id: 'ing_cup16', name: 'Gelas Cup Dingin 16oz + Tutup', unit: 'pcs', currentStock: 450, minStock: 100, costPerUnit: 900, updatedAt: now },
    { id: 'ing_brioche', name: 'Roti Brioche Toast Tebal', unit: 'lembar', currentStock: 80, minStock: 20, costPerUnit: 3500, updatedAt: now },
    { id: 'ing_beef', name: 'Smoked Beef Ham Slice', unit: 'lembar', currentStock: 120, minStock: 30, costPerUnit: 2500, updatedAt: now },
    { id: 'ing_mozza', name: 'Keju Mozzarella Parut', unit: 'gram', currentStock: 1800, minStock: 400, costPerUnit: 140, updatedAt: now },
    { id: 'ing_fries', name: 'Kentang Goreng Shoestring', unit: 'gram', currentStock: 4500, minStock: 1000, costPerUnit: 45, updatedAt: now },
  ];
  initialIngredients.forEach((ing) => tx.objectStore('ingredients').put(ing));

  // Products
  const initialProducts: Product[] = [
    {
      id: 'prd_kopisusu',
      name: 'Kopi Susu Gula Aren',
      categoryId: 'cat_coffee',
      price: 22000,
      costPrice: 8135,
      isAvailable: true,
      image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=500&q=80',
      description: 'Espresso Arabika Gayo dipadu susu segar lembut dan gula aren murni.',
      recipe: [
        { ingredientId: 'ing_arabica', quantity: 18 },
        { ingredientId: 'ing_freshmilk', quantity: 120 },
        { ingredientId: 'ing_aren', quantity: 25 },
        { ingredientId: 'ing_cup16', quantity: 1 },
      ],
      variations: [
        {
          name: 'Ukuran',
          options: [
            { id: 'reg', name: 'Regular 16oz', priceDelta: 0 },
            { id: 'lrg', name: 'Large 22oz (+Rp 4.000)', priceDelta: 4000 },
          ],
        },
      ],
      modifiers: [
        { name: 'Tingkat Manis', options: ['Normal Sweet', 'Less Sugar (50%)', 'No Sugar'] },
        { name: 'Es Batu', options: ['Normal Ice', 'Less Ice', 'No Ice'] },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_latte',
      name: 'Cafe Latte',
      categoryId: 'cat_coffee',
      price: 26000,
      costPrice: 8460,
      isAvailable: true,
      image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=500&q=80',
      description: 'Espresso aromatik berpadu steamed fresh milk halus.',
      recipe: [
        { ingredientId: 'ing_arabica', quantity: 18 },
        { ingredientId: 'ing_freshmilk', quantity: 180 },
        { ingredientId: 'ing_cup16', quantity: 1 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_matcha',
      name: 'Matcha Latte Uji',
      categoryId: 'cat_noncoffee',
      price: 28000,
      costPrice: 9750,
      isAvailable: true,
      image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=500&q=80',
      description: 'Matcha otentik Jepang dengan creamy milk bercita rasa earthy lembut.',
      recipe: [
        { ingredientId: 'ing_matcha', quantity: 15 },
        { ingredientId: 'ing_freshmilk', quantity: 180 },
        { ingredientId: 'ing_cup16', quantity: 1 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prd_beef_toast',
      name: 'Smoked Beef & Cheese Toast',
      categoryId: 'cat_food',
      price: 32000,
      costPrice: 17600,
      isAvailable: true,
      image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=500&q=80',
      description: 'Roti panggang brioche mentega dengan irisan daging asap dan keju lumer.',
      recipe: [
        { ingredientId: 'ing_brioche', quantity: 2 },
        { ingredientId: 'ing_beef', quantity: 2 },
        { ingredientId: 'ing_mozza', quantity: 40 },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
  initialProducts.forEach((p) => tx.objectStore('products').put(p));

  // Suppliers
  const initialSuppliers: Supplier[] = [
    {
      id: 'sup_roastery',
      name: 'CV Sentosa Roastery Mandiri',
      contactPerson: 'Hendra Wijaya',
      phone: '0811-2233-4455',
      email: 'sales@sentosaroastery.co.id',
      address: 'Jl. Kopo No. 128, Bandung',
      paymentTerms: 'Tempo 14 Hari',
    },
  ];
  initialSuppliers.forEach((s) => tx.objectStore('suppliers').put(s));

  const log: AuditLog = {
    id: generateUUID(),
    timestamp: now,
    userName: 'Owner',
    role: 'owner',
    action: 'Muat Menu Contoh',
    details: 'Berhasil memuat 4 menu sampel kopi & makanan beserta bahan baku resep.',
  };
  tx.objectStore('audit_logs').put(log);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      notifyChange('all');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// --------------------------------------------------------------------------------
// Atomic Transaction Processing: Complete Sale + Deduct Recipes Exactly Once
// --------------------------------------------------------------------------------

export interface CompleteSaleResult {
  sale: Sale;
  deductedIngredients: { ingredientId: string; name: string; amount: number; remaining: number }[];
  warning?: string;
}

export async function processSaleTransaction(
  saleData: Omit<Sale, 'id' | 'syncStatus' | 'cogsTotal'> & { id?: string }
): Promise<CompleteSaleResult> {
  const db = await getDB();
  const saleId = saleData.id || 'sale_' + generateUUID();

  // 1. Check idempotency: If sale with this operationId already exists, do NOT duplicate!
  const existingSales = await getAllFromStore<Sale>('sales');
  const existingSale = existingSales.find((s) => s.operationId === saleData.operationId);
  if (existingSale) {
    return {
      sale: existingSale,
      deductedIngredients: [],
      warning: 'Transaksi sudah pernah diproses sebelumnya (Idempotent replay dicegah).',
    };
  }

  // 2. Calculate COGS and gather recipe deductions
  const allIngredients = await getAllFromStore<Ingredient>('ingredients');
  const ingredientMap = new Map<string, Ingredient>();
  allIngredients.forEach((ing) => ingredientMap.set(ing.id, ing));

  let cogsTotal = 0;
  const ingredientUsage = new Map<string, number>();

  for (const item of saleData.items) {
    if (item.recipe && item.recipe.length > 0) {
      for (const rec of item.recipe) {
        const usage = rec.quantity * item.quantity;
        const currentTotal = ingredientUsage.get(rec.ingredientId) || 0;
        ingredientUsage.set(rec.ingredientId, currentTotal + usage);

        const ing = ingredientMap.get(rec.ingredientId);
        if (ing) {
          cogsTotal += usage * ing.costPerUnit;
        }
      }
    }
  }

  // 3. Perform atomic transaction across: sales, ingredients, inventory_movements, cash_sessions, sync_queue
  const tx = db.transaction(
    ['sales', 'ingredients', 'inventory_movements', 'cash_sessions', 'sync_queue'],
    'readwrite'
  );

  const completedSale: Sale = {
    ...saleData,
    id: saleId,
    cogsTotal: Math.round(cogsTotal),
    syncStatus: 'local_pending',
    refundStatus: 'none',
  };

  // Put sale
  tx.objectStore('sales').put(completedSale);

  const deductedDetails: { ingredientId: string; name: string; amount: number; remaining: number }[] = [];
  const now = new Date().toISOString();

  // Deduct each ingredient and create inventory_movements
  for (const [ingredientId, usedAmount] of ingredientUsage.entries()) {
    const ing = ingredientMap.get(ingredientId);
    if (ing) {
      const prevStock = ing.currentStock;
      const newStock = Math.max(0, prevStock - usedAmount); // Ensure non-negative representation
      ing.currentStock = newStock;
      ing.updatedAt = now;
      tx.objectStore('ingredients').put(ing);

      // Record movement audit
      const move: InventoryMovement = {
        id: generateUUID(),
        ingredientId,
        ingredientName: ing.name,
        type: 'sale_deduction',
        quantityChange: -usedAmount,
        previousStock: prevStock,
        newStock: newStock,
        reason: `Pengurangan resep POS: ${completedSale.transactionNumber}`,
        referenceId: completedSale.id,
        performedBy: completedSale.cashierName,
        createdAt: now,
      };
      tx.objectStore('inventory_movements').put(move);

      deductedDetails.push({
        ingredientId,
        name: ing.name,
        amount: usedAmount,
        remaining: newStock,
      });
    }
  }

  // Update active cashier session cash metrics if paid
  if (completedSale.sessionId && completedSale.paymentStatus === 'paid') {
    const sessionReq = tx.objectStore('cash_sessions').get(completedSale.sessionId);
    sessionReq.onsuccess = () => {
      const session = sessionReq.result as CashSession | undefined;
      if (session && session.status === 'open') {
        if (completedSale.paymentMethod === 'cash') {
          session.cashSales = (session.cashSales || 0) + completedSale.totalAmount;
          session.expectedCash = session.openingBalance + session.cashSales;
        } else {
          session.nonCashSales = (session.nonCashSales || 0) + completedSale.totalAmount;
        }
        tx.objectStore('cash_sessions').put(session);
      }
    };
  }

  // Enqueue for cloud sync
  const syncItem: SyncQueueItem = {
    id: generateUUID(),
    operationId: completedSale.operationId,
    entityType: 'sale',
    entityId: completedSale.id,
    payload: completedSale,
    status: 'pending',
    attempts: 0,
    createdAt: now,
  };
  tx.objectStore('sync_queue').put(syncItem);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      notifyChange('sales');
      notifyChange('ingredients');
      notifyChange('cash_sessions');
      notifyChange('sync_queue');
      resolve({
        sale: completedSale,
        deductedIngredients: deductedDetails,
      });
    };
    tx.onerror = () => reject(tx.error);
  });
}

// --------------------------------------------------------------------------------
// Refund Transaction Processing
// --------------------------------------------------------------------------------

export async function processRefundTransaction(
  saleId: string,
  reason: string,
  authorizedBy: string,
  returnInventory: boolean
): Promise<Refund> {
  const db = await getDB();
  const sale = await getFromStore<Sale>('sales', saleId);
  if (!sale) {
    throw new Error('Transaksi tidak ditemukan.');
  }
  if (sale.refundStatus === 'refunded') {
    throw new Error('Transaksi ini sudah pernah dibatalkan/di-refund sebelumnya.');
  }

  const refundId = 'rf_' + generateUUID();
  const refundNumber = generateTransactionNumber('RF');
  const now = new Date().toISOString();

  const refundRecord: Refund = {
    id: refundId,
    refundNumber,
    saleId: sale.id,
    transactionNumber: sale.transactionNumber,
    amount: sale.totalAmount,
    returnInventory,
    reason,
    authorizedBy,
    createdAt: now,
  };

  const tx = db.transaction(
    ['sales', 'refunds', 'ingredients', 'inventory_movements', 'cash_sessions'],
    'readwrite'
  );

  // Update sale status
  sale.refundStatus = 'refunded';
  sale.refundId = refundId;
  tx.objectStore('sales').put(sale);
  tx.objectStore('refunds').put(refundRecord);

  // Return ingredients if returnInventory is true
  if (returnInventory) {
    const allIngredients = await getAllFromStore<Ingredient>('ingredients');
    const ingredientMap = new Map<string, Ingredient>();
    allIngredients.forEach((ing) => ingredientMap.set(ing.id, ing));

    for (const item of sale.items) {
      if (item.recipe && item.recipe.length > 0) {
        for (const rec of item.recipe) {
          const qtyToReturn = rec.quantity * item.quantity;
          const ing = ingredientMap.get(rec.ingredientId);
          if (ing) {
            const prevStock = ing.currentStock;
            const newStock = prevStock + qtyToReturn;
            ing.currentStock = newStock;
            ing.updatedAt = now;
            tx.objectStore('ingredients').put(ing);

            const move: InventoryMovement = {
              id: generateUUID(),
              ingredientId: ing.id,
              ingredientName: ing.name,
              type: 'refund_return',
              quantityChange: qtyToReturn,
              previousStock: prevStock,
              newStock: newStock,
              reason: `Pengembalian stok refund: ${sale.transactionNumber}`,
              referenceId: refundId,
              performedBy: authorizedBy,
              createdAt: now,
            };
            tx.objectStore('inventory_movements').put(move);
          }
        }
      }
    }
  }

  // Update cashier session if cash sale
  if (sale.sessionId && sale.paymentMethod === 'cash') {
    const sessionReq = tx.objectStore('cash_sessions').get(sale.sessionId);
    sessionReq.onsuccess = () => {
      const session = sessionReq.result as CashSession | undefined;
      if (session) {
        session.cashSales = Math.max(0, (session.cashSales || 0) - sale.totalAmount);
        session.expectedCash = session.openingBalance + session.cashSales;
        tx.objectStore('cash_sessions').put(session);
      }
    };
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      notifyChange('sales');
      notifyChange('refunds');
      notifyChange('ingredients');
      notifyChange('cash_sessions');
      resolve(refundRecord);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// --------------------------------------------------------------------------------
// Receive Purchase Order (Increases Stock Atomically)
// --------------------------------------------------------------------------------

export async function receivePurchaseOrder(poId: string, receivedBy: string): Promise<PurchaseOrder> {
  const db = await getDB();
  const po = await getFromStore<PurchaseOrder>('purchase_orders', poId);
  if (!po) throw new Error('Purchase Order tidak ditemukan.');
  if (po.status === 'received') throw new Error('Purchase Order sudah pernah diterima sebelumnya.');

  const tx = db.transaction(['purchase_orders', 'ingredients', 'inventory_movements'], 'readwrite');
  const now = new Date().toISOString();
  po.status = 'received';
  po.receivedAt = now;
  tx.objectStore('purchase_orders').put(po);

  // Fetch ingredients and update stock
  for (const item of po.items) {
    const ingReq = tx.objectStore('ingredients').get(item.ingredientId);
    ingReq.onsuccess = () => {
      const ing = ingReq.result as Ingredient | undefined;
      if (ing) {
        const prevStock = ing.currentStock;
        const newStock = prevStock + item.quantity;
        ing.currentStock = newStock;
        // Optionally update unit cost if provided
        if (item.unitPrice > 0) {
          ing.costPerUnit = item.unitPrice;
        }
        ing.updatedAt = now;
        tx.objectStore('ingredients').put(ing);

        const move: InventoryMovement = {
          id: generateUUID(),
          ingredientId: ing.id,
          ingredientName: ing.name,
          type: 'purchase_in',
          quantityChange: item.quantity,
          previousStock: prevStock,
          newStock: newStock,
          reason: `Penerimaan Pembelian ${po.poNumber} dari ${po.supplierName}`,
          referenceId: po.id,
          performedBy: receivedBy,
          createdAt: now,
        };
        tx.objectStore('inventory_movements').put(move);
      }
    };
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      notifyChange('purchase_orders');
      notifyChange('ingredients');
      resolve(po);
    };
    tx.onerror = () => reject(tx.error);
  });
}
