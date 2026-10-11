export type Role = 'owner' | 'manager' | 'cashier';

export interface UserProfile {
  id: string;
  name: string;
  role: Role;
  pin: string;
  email: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

export interface CafeSettings {
  id: string;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  taxPercentage: number;
  servicePercentage: number;
  currency: string;
  receiptFooter: string;
  paperWidth: '58mm' | '80mm';
  singleCashierMode: boolean;
  qrisMerchantName: string;
  qrisNmid: string;
  autoSyncOnOnline: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  sortOrder: number;
}

export type UnitType = 'gram' | 'ml' | 'pcs' | 'porsi' | 'lembar';

export interface Ingredient {
  id: string;
  name: string;
  unit: UnitType;
  currentStock: number;
  minStock: number;
  costPerUnit: number; // In Rupiah per unit
  updatedAt: string;
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number; // Amount of unit used per 1 portion
}

export interface ProductVariationOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface ProductVariation {
  id?: string;
  name: string; // e.g. "Ukuran"
  options: ProductVariationOption[];
}

export interface ProductModifier {
  id?: string;
  name: string; // e.g. "Level Gula", "Suhu"
  options: string[];
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  costPrice: number; // Calculated COGS or default
  image?: string;
  description?: string;
  isAvailable: boolean;
  recipe: RecipeItem[];
  variations?: ProductVariation[];
  modifiers?: ProductModifier[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  categoryName?: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  selectedVariation?: ProductVariationOption;
  selectedModifiers?: Record<string, string>;
  notes?: string;
  recipe: RecipeItem[];
}

export type PaymentMethod = 'cash' | 'qris' | 'transfer' | 'debit';
export type PaymentStatus = 'paid' | 'awaiting_confirmation' | 'cancelled';
export type SyncStatus = 'local_pending' | 'syncing' | 'synced' | 'sync_failed';

export interface Sale {
  id: string;
  transactionNumber: string; // e.g. KD-20261011-0001
  operationId: string; // Idempotency UUID
  sessionId: string;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  tableNumber?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  serviceRate: number;
  serviceAmount: number;
  totalAmount: number;
  cogsTotal: number; // Recipe cost sum
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashTendered?: number;
  cashChange?: number;
  qrisReference?: string;
  qrisConfirmedBy?: string;
  syncStatus: SyncStatus;
  syncError?: string;
  syncedAt?: string;
  refundStatus?: 'none' | 'refunded';
  refundId?: string;
  notes?: string;
  createdAt: string;
}

export type MovementType = 'sale_deduction' | 'purchase_in' | 'manual_adjustment' | 'waste_spoilage' | 'refund_return';

export interface InventoryMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: MovementType;
  quantityChange: number; // positive or negative
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string; // saleId, poId, refundId
  performedBy: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  paymentTerms: string;
}

export interface PurchaseOrderItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: UnitType;
  unitPrice: number;
  subtotal: number;
}

export type POStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: POStatus;
  orderedAt: string;
  receivedAt?: string;
  notes?: string;
}

export type ExpenseCategory =
  | 'Sewa Tempat'
  | 'Listrik & Air'
  | 'Internet & Telepon'
  | 'Gaji & Upah Karyawan'
  | 'Kemasan & Packaging'
  | 'Pemeliharaan & Kebersihan'
  | 'Bahan Penolong'
  | 'Operasional Lainnya';

export interface Expense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'transfer' | 'petty_cash';
  notes: string;
  createdBy: string;
  createdAt: string;
}

export interface CashSession {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  cashSales: number;
  nonCashSales: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number; // actualCash - expectedCash
  notes?: string;
  status: 'open' | 'closed';
}

export interface Refund {
  id: string;
  refundNumber: string;
  saleId: string;
  transactionNumber: string;
  amount: number;
  returnInventory: boolean;
  reason: string;
  authorizedBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  role: Role;
  action: string;
  details: string;
}

export interface SyncQueueItem {
  id: string;
  operationId: string;
  entityType: 'sale' | 'inventory_movement' | 'session' | 'expense';
  entityId: string;
  payload: any;
  status: 'pending' | 'syncing' | 'failed' | 'done';
  attempts: number;
  lastAttempt?: string;
  error?: string;
  createdAt: string;
}
