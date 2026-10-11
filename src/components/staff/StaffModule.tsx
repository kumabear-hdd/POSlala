import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Shield,
  Key,
  CheckCircle,
  Trash2,
  Edit2,
  Lock,
  UserCheck,
} from 'lucide-react';
import { Role, UserProfile } from '../../types';
import { getAllFromStore, onDBChange, putToStore } from '../../services/db';
import { formatDateTime, generateUUID } from '../../utils/format';
import { useApp } from '../../context/AppContext';

export const StaffModule: React.FC = () => {
  const { allUsers, activeUser, setActiveUser, showToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [pin, setPin] = useState('1234');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setRole('cashier');
    setPin('1234');
    setEmail('');
    setPhone('');
    setIsModalOpen(true);
  };

  const openEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setName(u.name);
    setRole(u.role);
    setPin(u.pin);
    setEmail(u.email);
    setPhone(u.phone);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!pin || pin.length < 4) {
      showToast('PIN otorisasi minimal 4 digit angka.', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: editingUser ? editingUser.id : 'usr_' + generateUUID(),
      name: name.trim(),
      role,
      pin: pin.trim(),
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '')}@kedai.com`,
      phone: phone.trim() || '0812-0000-0000',
      active: true,
      createdAt: editingUser ? editingUser.createdAt : now,
    };

    await putToStore('profiles', profile);
    showToast(`Data staf "${profile.name}" berhasil disimpan.`, 'success');
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Staf & Hak Akses (RBAC)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Atur hierarki peran kasir, manajer operasional, dan owner kafe beserta PIN otorisasi.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Staf Baru</span>
        </button>
      </div>

      {/* Role Permission Matrix Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-500" />
          Matriks Hak Akses Peran POS Lapak
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-extrabold text-slate-900 text-xs text-amber-700">
              👑 Owner / Super Admin
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Akses menyeluruh 100%: Pengaturan kafe, laporan laba rugi, pengelolaan staf & PIN, database, dan otorisasi refund.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-extrabold text-slate-900 text-xs text-blue-700">
              📋 Manajer Operasional
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Akses operasional: Manajemen produk & resep, inventaris bahan baku, pembuatan & penerimaan PO, pencatatan beban operasional.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-extrabold text-slate-900 text-xs text-emerald-700">
              ☕ Kasir (Cashier)
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Fokus POS & Shift: Buka/tutup shift kasir, hitung uang fisik, transaksi pesanan, struk thermal, dan offline persistence.
            </p>
          </div>
        </div>
      </div>

      {/* Staff Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allUsers.map((u) => {
          const isActive = activeUser?.id === u.id;

          return (
            <div
              key={u.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs space-y-3 transition flex flex-col justify-between ${
                isActive ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      u.role === 'owner'
                        ? 'bg-amber-100 text-amber-800'
                        : u.role === 'manager'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {u.role}
                  </span>

                  {isActive ? (
                    <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      Aktif Digunakan
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveUser(u);
                        showToast(`Beralih ke profil: ${u.name} (${u.role})`, 'info');
                      }}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-900 transition"
                    >
                      Pilih Profil Ini &rarr;
                    </button>
                  )}
                </div>

                <h4 className="font-black text-base text-slate-900 mt-2">{u.name}</h4>
                <div className="text-xs text-slate-500 space-y-0.5 mt-1">
                  <div>Email: {u.email}</div>
                  <div>Telp: {u.phone}</div>
                  <div className="flex items-center gap-1.5 pt-1 text-slate-700 font-semibold">
                    <Key className="w-3 h-3 text-slate-400" />
                    <span>PIN: ****</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  Didaftarkan: {formatDateTime(u.createdAt)}
                </span>
                <button
                  onClick={() => openEditModal(u)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD / EDIT STAFF */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingUser ? 'Edit Staf & PIN' : 'Tambah Staf Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dimas Pratama"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Peran (Role):</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="cashier">Kasir (Cashier)</option>
                    <option value="manager">Manajer</option>
                    <option value="owner">Owner / Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">PIN Otorisasi (4 Digit):</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold tracking-widest text-center"
                    placeholder="1234"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@kedai.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp:</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812-3456-7890"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

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
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  Simpan Staf
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
