import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  Boxes,
  Truck,
  ReceiptText,
  BarChart3,
  Users,
  Clock,
  Settings,
  Lock,
} from 'lucide-react';
import { useApp, TabKey } from '../../context/AppContext';

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.FC<{ className?: string }>;
  minRole: 'cashier' | 'manager' | 'owner';
  badge?: string;
}

const navItems: NavItem[] = [
  { key: 'pos', label: 'Kasir POS', icon: ShoppingCart, minRole: 'cashier', badge: 'Utama' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, minRole: 'manager' },
  { key: 'products', label: 'Produk & Menu', icon: UtensilsCrossed, minRole: 'cashier' },
  { key: 'inventory', label: 'Inventaris & Resep', icon: Boxes, minRole: 'manager' },
  { key: 'suppliers', label: 'Pemasok & Pembelian', icon: Truck, minRole: 'manager' },
  { key: 'expenses', label: 'Pengeluaran', icon: ReceiptText, minRole: 'manager' },
  { key: 'reports', label: 'Laporan & Analitik', icon: BarChart3, minRole: 'manager' },
  { key: 'sessions', label: 'Sesi Kasir (Shift)', icon: Clock, minRole: 'cashier' },
  { key: 'staff', label: 'Staf & Peran', icon: Users, minRole: 'owner' },
  { key: 'settings', label: 'Pengaturan Kafe', icon: Settings, minRole: 'owner' },
];

export const Sidebar: React.FC<{ isMobileMenuOpen: boolean; onCloseMobileMenu: () => void }> = ({
  isMobileMenuOpen,
  onCloseMobileMenu,
}) => {
  const { activeTab, setActiveTab, activeUser, showToast } = useApp();

  const userRole = activeUser?.role || 'cashier';

  const hasAccess = (itemMinRole: NavItem['minRole']): boolean => {
    if (userRole === 'owner') return true;
    if (userRole === 'manager') return itemMinRole === 'cashier' || itemMinRole === 'manager';
    // cashier
    return itemMinRole === 'cashier';
  };

  const handleNavClick = (item: NavItem) => {
    if (!hasAccess(item.minRole)) {
      showToast(
        `Akses terbatas: Menu "${item.label}" memerlukan peran ${
          item.minRole === 'owner' ? 'Owner / Admin' : 'Manajer'
        }. Silakan ganti peran di pojok kanan atas.`,
        'warning'
      );
      return;
    }
    setActiveTab(item.key);
    onCloseMobileMenu();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={onCloseMobileMenu}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed md:sticky top-16 z-30 h-[calc(100vh-4rem)] w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 transition-transform duration-200 ease-in-out select-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Navigation list */}
        <div className="p-3 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Menu Operasional
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.key;
            const allowed = hasAccess(item.minRole);

            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : allowed
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    : 'text-slate-500 hover:bg-slate-800/40 opacity-70 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-slate-950' : allowed ? 'text-slate-400' : 'text-slate-600'}`} />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {!allowed && <Lock className="w-3 h-3 text-slate-600" />}
                  {item.badge && isSelected && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-950/20 text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info card */}
        <div className="p-3 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center justify-between font-semibold text-slate-300 mb-1">
              <span>POS Lapak v1.2</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PWA Ready
              </span>
            </div>
            <p className="leading-relaxed text-[11px]">
              Offline-first POS & sinkronisasi multi-transaksi dengan keamanan inventaris resep.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
