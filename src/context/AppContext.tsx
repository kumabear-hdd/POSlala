import React, { createContext, useContext, useEffect, useState } from 'react';
import { CafeSettings, CashSession, UserProfile } from '../types';
import { getAllFromStore, getFromStore, onDBChange, putToStore, seedInitialDataIfNeeded } from '../services/db';
import { getSyncStatusSummary, onSyncChange, SyncStatusSummary, triggerSync } from '../services/sync';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export type TabKey =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'suppliers'
  | 'expenses'
  | 'reports'
  | 'staff'
  | 'sessions'
  | 'settings';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface AppContextType {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  activeUser: UserProfile | null;
  setActiveUser: (user: UserProfile) => void;
  allUsers: UserProfile[];
  activeSession: CashSession | null;
  refreshActiveSession: () => Promise<void>;
  settings: CafeSettings;
  updateSettings: (newSettings: Partial<CafeSettings>) => Promise<void>;
  isOnline: boolean;
  syncSummary: SyncStatusSummary;
  handleManualSync: () => Promise<void>;
  isInitialLoading: boolean;
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastItem['type']) => void;
  dismissToast: (id: string) => void;
  openReceiptModalWithSaleId: string | null;
  setOpenReceiptModalWithSaleId: (id: string | null) => void;
}

const defaultSettings: CafeSettings = {
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

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTabState] = useState<TabKey>('pos');
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [settings, setSettings] = useState<CafeSettings>(defaultSettings);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [openReceiptModalWithSaleId, setOpenReceiptModalWithSaleId] = useState<string | null>(null);

  const [syncSummary, setSyncSummary] = useState<SyncStatusSummary>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    syncedCount: 0,
    failedCount: 0,
    lastSyncTime: null,
    lastError: null,
  });

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: ToastItem['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync tab with URL hash for persistent navigation across reloads
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as TabKey;
    const validTabs: TabKey[] = [
      'dashboard',
      'pos',
      'products',
      'inventory',
      'suppliers',
      'expenses',
      'reports',
      'staff',
      'sessions',
      'settings',
    ];
    if (hash && validTabs.includes(hash)) {
      setActiveTabState(hash);
    }
  }, []);

  const setActiveTab = (tab: TabKey) => {
    setActiveTabState(tab);
    window.location.hash = tab;
  };

  // Load active session from DB
  const refreshActiveSession = async () => {
    const sessions = await getAllFromStore<CashSession>('cash_sessions');
    const openSession = sessions.find((s) => s.status === 'open');
    setActiveSession(openSession || null);
  };

  // Initialize DB and core data
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await seedInitialDataIfNeeded();

        // 1. Settings
        let loadedSettings = await getFromStore<CafeSettings>('cafe_settings', 'default_cafe');
        if (mounted && loadedSettings) {
          if (loadedSettings.name === 'Kedai Kopi Bahagia') {
            loadedSettings.name = 'POS Lapak';
            loadedSettings.tagline = 'Sistem Manajemen Kafe & Kasir Pintar';
            loadedSettings.receiptFooter = 'Terima kasih telah berkunjung ke POS Lapak!\nFollow IG: @poslapak.id';
            loadedSettings.qrisMerchantName = 'POS LAPAK INDONESIA';
            await putToStore('cafe_settings', loadedSettings);
          }
          setSettings(loadedSettings);
        }

        // 2. Users
        const loadedUsers = await getAllFromStore<UserProfile>('profiles');
        if (mounted && loadedUsers.length > 0) {
          setAllUsers(loadedUsers);
          // Default to Cashier for fast POS usage or Owner
          const defaultCashier = loadedUsers.find((u) => u.role === 'cashier') || loadedUsers[0];
          setActiveUser(defaultCashier);
        }

        // 3. Active Session
        await refreshActiveSession();

        // 4. Initial Sync Summary
        const summary = await getSyncStatusSummary();
        if (mounted) {
          setSyncSummary(summary);
        }
      } catch (err) {
        console.error('Database initialization error:', err);
      } finally {
        if (mounted) setIsInitialLoading(false);
      }
    }

    init();

    // Listeners
    const unsubscribeDB = onDBChange(async (store) => {
      if (store === 'cash_sessions' || store === 'all') {
        await refreshActiveSession();
      }
      if (store === 'profiles' || store === 'all') {
        const u = await getAllFromStore<UserProfile>('profiles');
        setAllUsers(u);
      }
      if (store === 'cafe_settings' || store === 'all') {
        const s = await getFromStore<CafeSettings>('cafe_settings', 'default_cafe');
        if (s) setSettings(s);
      }
      if (store === 'sync_queue' || store === 'sales' || store === 'all') {
        const sum = await getSyncStatusSummary();
        setSyncSummary(sum);
      }
    });

    const unsubscribeSync = onSyncChange((status) => {
      setSyncSummary(status);
    });

    return () => {
      mounted = false;
      unsubscribeDB();
      unsubscribeSync();
    };
  }, []);

  // Update Settings
  const updateSettings = async (newSettings: Partial<CafeSettings>) => {
    const merged = { ...settings, ...newSettings };
    await putToStore('cafe_settings', merged);
    setSettings(merged);
    showToast('Pengaturan kafe berhasil diperbarui.', 'success');
  };

  // Manual Sync trigger
  const handleManualSync = async () => {
    showToast('Memulai sinkronisasi transaksi lokal...', 'info');
    const result = await triggerSync();
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        activeUser,
        setActiveUser,
        allUsers,
        activeSession,
        refreshActiveSession,
        settings,
        updateSettings,
        isOnline,
        syncSummary,
        handleManualSync,
        isInitialLoading,
        toasts,
        showToast,
        dismissToast,
        openReceiptModalWithSaleId,
        setOpenReceiptModalWithSaleId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
