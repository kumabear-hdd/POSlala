import React, { useState } from 'react';
import {
  Coffee,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  User,
  ChevronDown,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { formatRupiah } from '../../utils/format';

export const Navbar: React.FC<{ onToggleMobileMenu: () => void; isMobileMenuOpen: boolean }> = ({
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const {
    settings,
    activeUser,
    setActiveUser,
    allUsers,
    activeSession,
    isOnline,
    syncSummary,
    handleManualSync,
    setActiveTab,
  } = useApp();

  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white select-none">
      <div className="px-4 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/10 group-hover:scale-105 transition">
              <Coffee className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white">{settings.name}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  POS
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-xs">
                {settings.tagline || 'Sistem Kasir & Manajemen Kafe'}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Shift & Session Status */}
        <div className="hidden lg:flex items-center gap-3">
          {activeSession ? (
            <button
              onClick={() => setActiveTab('sessions')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/20 transition"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Shift Aktif: <strong>{activeSession.cashierName}</strong></span>
              <span className="text-slate-400">|</span>
              <span className="text-emerald-200">Kas: {formatRupiah(activeSession.expectedCash)}</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('sessions')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/20 transition"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Shift Kasir Belum Dibuka — Klik untuk Buka</span>
            </button>
          )}
        </div>

        {/* Right: Network status, Sync indicator, PWA, Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* PWA Install Button */}
          <PWAInstallButton variant="navbar" />

          {/* Sync & Connectivity Badge */}
          <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}

            {syncSummary.pendingCount > 0 && (
              <button
                onClick={handleManualSync}
                disabled={syncSummary.isSyncing}
                title={`${syncSummary.pendingCount} transaksi lokal belum tersinkronisasi`}
                className="ml-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-semibold transition"
              >
                <RefreshCw className={`w-3 h-3 ${syncSummary.isSyncing ? 'animate-spin' : ''}`} />
                <span>{syncSummary.pendingCount}</span>
              </button>
            )}
          </div>

          {/* User & Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-left transition"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                {activeUser?.name ? activeUser.name.charAt(0) : 'U'}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold leading-tight text-slate-100 flex items-center gap-1">
                  {activeUser?.name || 'Kasir'}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-[10px] text-amber-400 uppercase font-medium tracking-wide">
                  {activeUser?.role === 'owner' ? 'Owner / Admin' : activeUser?.role === 'manager' ? 'Manajer' : 'Kasir'}
                </div>
              </div>
            </button>

            {/* Dropdown for Role Switching */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 text-slate-200">
                <div className="px-3 py-2 border-b border-slate-800">
                  <div className="text-xs text-slate-400">Ganti Profil Aktif (Simulasi Hak Akses)</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{activeUser?.name}</div>
                </div>

                <div className="py-1 space-y-1">
                  {allUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setActiveUser(user);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition ${
                        activeUser?.id === user.id ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <div>{user.name}</div>
                          <div className="text-[10px] text-slate-400 capitalize">{user.role}</div>
                        </div>
                      </div>
                      {activeUser?.id === user.id && (
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 text-center">
                  <button
                    onClick={() => {
                      setActiveTab('staff');
                      setShowUserDropdown(false);
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 transition"
                  >
                    Kelola Staf & PIN Kasir &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
