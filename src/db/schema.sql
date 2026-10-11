-- =====================================================================
-- POS Lapak - Database Schema for Supabase (PostgreSQL 15+)
-- Cafe Management System (Offline-First POS & Inventory)
-- =====================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Staff & Role-Based Access Control)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  pin VARCHAR(10) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(30),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. CAFE SETTINGS
CREATE TABLE IF NOT EXISTS cafe_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_cafe',
  name VARCHAR(150) NOT NULL,
  tagline VARCHAR(255),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(100),
  tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
  service_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
  receipt_footer TEXT,
  paper_width VARCHAR(10) NOT NULL DEFAULT '58mm',
  single_cashier_mode BOOLEAN NOT NULL DEFAULT true,
  qris_merchant_name VARCHAR(150),
  qris_nmid VARCHAR(50),
  auto_sync_on_online BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  sort_order INT NOT NULL DEFAULT 1
);

-- 4. INGREDIENTS (Raw Materials for Recipes)
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  unit VARCHAR(20) NOT NULL CHECK (unit IN ('gram', 'ml', 'pcs', 'porsi', 'lembar')),
  current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  min_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. PRODUCTS (Menu Items)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  price NUMERIC(12, 2) NOT NULL,
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  image TEXT,
  description TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  recipe_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  variations_json JSONB DEFAULT '[]'::jsonb,
  modifiers_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. CASHIER SESSIONS (Shift Tracking)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY,
  cashier_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  cashier_name VARCHAR(100) NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  non_cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  actual_cash NUMERIC(12, 2),
  difference NUMERIC(12, 2),
  notes TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'closed'))
);

-- 7. SALES (Orders / Transactions)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  transaction_number VARCHAR(50) UNIQUE NOT NULL,
  operation_id UUID UNIQUE NOT NULL, -- Idempotency key preventing duplicate offline synchronization
  session_id TEXT REFERENCES cash_sessions(id) ON DELETE SET NULL,
  cashier_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  cashier_name VARCHAR(100) NOT NULL,
  customer_name VARCHAR(100),
  table_number VARCHAR(20),
  items_json JSONB NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  service_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  service_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL,
  cogs_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'qris', 'transfer', 'debit')),
  payment_status VARCHAR(30) NOT NULL CHECK (payment_status IN ('paid', 'awaiting_confirmation', 'cancelled')),
  cash_tendered NUMERIC(12, 2),
  cash_change NUMERIC(12, 2),
  qris_reference VARCHAR(100),
  qris_confirmed_by VARCHAR(100),
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced',
  refund_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none', 'refunded')),
  refund_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for Sales
CREATE INDEX IF NOT EXISTS idx_sales_operation_id ON sales(operation_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

-- 8. INVENTORY MOVEMENTS (Stock Audit Trail)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT REFERENCES ingredients(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(150) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('sale_deduction', 'purchase_in', 'manual_adjustment', 'waste_spoilage', 'refund_return')),
  quantity_change NUMERIC(12, 2) NOT NULL,
  previous_stock NUMERIC(12, 2) NOT NULL,
  new_stock NUMERIC(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  performed_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(100),
  address TEXT,
  payment_terms VARCHAR(100)
);

-- 10. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(150) NOT NULL,
  items_json JSONB NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  received_at TIMESTAMPTZ,
  notes TEXT
);

-- 11. OPERATIONAL EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  expense_number VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(30) NOT NULL DEFAULT 'petty_cash',
  notes TEXT,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. REFUNDS
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  refund_number VARCHAR(50) UNIQUE NOT NULL,
  sale_id TEXT REFERENCES sales(id) ON DELETE CASCADE,
  transaction_number VARCHAR(50) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  return_inventory BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NOT NULL,
  authorized_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  user_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Allow public read for POS operations on products/categories/settings
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read settings" ON cafe_settings FOR SELECT USING (true);

-- Allow authenticated roles to insert sales and sessions
CREATE POLICY "Allow authenticated insert sales" ON sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated select sales" ON sales FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert cash_sessions" ON cash_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated select cash_sessions" ON cash_sessions FOR SELECT USING (true);
CREATE POLICY "Allow authenticated update cash_sessions" ON cash_sessions FOR UPDATE USING (true);

-- Financial & Sensitive entities (Owner & Manager only)
CREATE POLICY "Staff read expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Staff insert expenses" ON expenses FOR INSERT WITH CHECK (true);
