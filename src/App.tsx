import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { ToastContainer } from './components/ui/ToastContainer';
import { POSModule } from './components/pos/POSModule';
import { DashboardModule } from './components/dashboard/DashboardModule';
import { ProductsModule } from './components/products/ProductsModule';
import { InventoryModule } from './components/inventory/InventoryModule';
import { SuppliersModule } from './components/suppliers/SuppliersModule';
import { ExpensesModule } from './components/expenses/ExpensesModule';
import { ReportsModule } from './components/reports/ReportsModule';
import { StaffModule } from './components/staff/StaffModule';
import { CashierSessionsModule } from './components/cashier/CashierSessionsModule';
import { SettingsModule } from './components/settings/SettingsModule';
import { RegisterOwnerScreen } from './components/auth/RegisterOwnerScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { Coffee } from 'lucide-react';

const AppContent: React.FC = () => {
  const { activeTab, isInitialLoading, hasOwner, activeUser } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center animate-pulse">
          <Coffee className="w-8 h-8" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-black tracking-tight">POS Lapak</h2>
          <p className="text-xs text-slate-400">Menyiapkan database lokal IndexedDB & PWA...</p>
        </div>
      </div>
    );
  }

  // 1. First-time setup: If no owner registered yet
  if (!hasOwner) {
    return (
      <>
        <ToastContainer />
        <RegisterOwnerScreen />
      </>
    );
  }

  // 2. Authentication: If not logged in with PIN
  if (!activeUser) {
    return (
      <>
        <ToastContainer />
        <LoginScreen />
      </>
    );
  }

  // 3. Authenticated App Layout
  const renderActiveModule = () => {
    switch (activeTab) {
      case 'pos':
        return <POSModule />;
      case 'dashboard':
        return <DashboardModule />;
      case 'products':
        return <ProductsModule />;
      case 'inventory':
        return <InventoryModule />;
      case 'suppliers':
        return <SuppliersModule />;
      case 'expenses':
        return <ExpensesModule />;
      case 'reports':
        return <ReportsModule />;
      case 'staff':
        return <StaffModule />;
      case 'sessions':
        return <CashierSessionsModule />;
      case 'settings':
        return <SettingsModule />;
      default:
        return <POSModule />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Toast notifications */}
      <ToastContainer />

      {/* Offline & pending sync banner */}
      <OfflineBanner />

      {/* Main sticky topbar */}
      <Navbar
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* Workspace: Sidebar + Dynamic Module */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100">
          {renderActiveModule()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
