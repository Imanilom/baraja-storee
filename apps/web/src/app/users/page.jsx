'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Lock,
  Mail,
  User,
  MapPin,
  ChevronDown,
  Info
} from 'lucide-react';
import { api, getStoredUser } from '../../lib/api';

const ROLE_CONFIG = {
  admin: {
    label: 'Administrator',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    description: 'Akses penuh ke semua modul, persetujuan marketlist, dan kelola user/RBAC'
  },
  management: {
    label: 'Management',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    description: 'Akses eksekutif & analitik (dashboard, audit marketlist, laba rugi, dan overhead)'
  },
  purchasing: {
    label: 'Purchasing',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    description: 'Pengajuan marketlist, pencatatan transaksi pembelian ke supplier & hutang belanja'
  },
  receiver: {
    label: 'Receiver / Gudang',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    description: 'Penerimaan fisik barang (surat jalan digital) dan verifikasi barang tiba'
  },
  accounting: {
    label: 'Accounting / Finance',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Kelola invoices, overhead operasional, pelunasan hutang, dan laporan laba rugi'
  }
};

export default function UserManagementPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showRbacGuide, setShowRbacGuide] = useState(false);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = create new
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'purchasing',
    location_id: '',
    is_active: true
  });

  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, locsRes] = await Promise.all([
        api.getUsers(),
        api.getLocations().catch(() => ({ data: [] }))
      ]);

      setUsers(usersRes.data || []);
      setLocations(locsRes.data || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'purchasing',
      location_id: locations.length > 0 ? locations[0]._id : '',
      is_active: true
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setFormData({
      name: u.name || '',
      email: u.email || '',
      password: '', // Blank means keep unchanged
      role: u.role || 'purchasing',
      location_id: u.location_id?._id || u.location_id || '',
      is_active: u.is_active !== undefined ? u.is_active : true
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);

    try {
      if (editingUser) {
        // Update user
        const payload = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          location_id: formData.location_id || null,
          is_active: formData.is_active
        };
        if (formData.password && formData.password.trim().length > 0) {
          payload.password = formData.password.trim();
        }

        await api.updateUser(editingUser._id, payload);
        showToast(`Data pengguna ${formData.name} berhasil diperbarui.`);
      } else {
        // Create new user
        if (!formData.password || formData.password.trim().length < 6) {
          throw new Error('Password wajib diisi minimal 6 karakter untuk akun baru.');
        }

        const payload = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: formData.role,
          location_id: formData.location_id || null,
          is_active: formData.is_active
        };

        await api.createUser(payload);
        showToast(`Pengguna baru ${formData.name} (${formData.role.toUpperCase()}) berhasil dibuat.`);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan pengguna.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (userToToggle) => {
    try {
      const newStatus = !userToToggle.is_active;
      await api.updateUser(userToToggle._id, { is_active: newStatus });
      showToast(`Status pengguna ${userToToggle.name} diubah menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Gagal mengubah status pengguna.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setActionLoading(true);
    setError(null);

    try {
      await api.deleteUser(deleteConfirmUser._id);
      showToast(`Akun pengguna ${deleteConfirmUser.name} telah dihapus.`);
      setDeleteConfirmUser(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Gagal menghapus pengguna.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      search === '' ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Access check
  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className="p-8">
        <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-6 text-amber-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <h2 className="text-lg font-bold">Akses Ditolak (RBAC: Admin Only)</h2>
          </div>
          <p className="text-sm text-amber-300/90">
            Halaman Manajemen Pengguna dan Konfigurasi Hak Akses (RBAC) hanya dapat dikelola oleh Administrator sistem.
            Akun Anda saat ini memiliki peran <strong>{currentUser.role?.toUpperCase()}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Manajemen Pengguna & RBAC</h1>
              <p className="text-sm text-slate-400">
                Kelola akun pengguna dan konfigurasi hak akses berbasis peran (Role-Based Access Control).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRbacGuide(!showRbacGuide)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            <Info className="w-4 h-4 text-purple-400" />
            <span>Matriks RBAC</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm flex items-center gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-sm flex items-center gap-3">
          <XCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* RBAC Guide Accordion */}
      {showRbacGuide && (
        <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
              <Shield className="w-4 h-4" />
              <span>Matriks Hak Akses Peran (Role-Based Access Control)</span>
            </div>
            <button
              onClick={() => setShowRbacGuide(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Tutup
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(ROLE_CONFIG).map(([roleKey, conf]) => (
              <div key={roleKey} className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white uppercase tracking-wider">{conf.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${conf.badgeClass}`}>
                    {roleKey}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{conf.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Pengguna</p>
          <p className="text-2xl font-bold text-white mt-1">{users.length}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Akun Aktif</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {users.filter((u) => u.is_active).length}
          </p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Administrator</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">
            {users.filter((u) => u.role === 'admin').length}
          </p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Staff Operasional</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {users.filter((u) => ['purchasing', 'receiver'].includes(u.role)).length}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nama atau email pengguna..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-sm text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
            >
              <option value="all">Semua Peran (Roles)</option>
              <option value="admin">Admin</option>
              <option value="purchasing">Purchasing</option>
              <option value="receiver">Receiver</option>
              <option value="accounting">Accounting</option>
              <option value="management">Management</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-sm text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Pengguna</th>
                <th className="px-6 py-3.5">Peran (Role RBAC)</th>
                <th className="px-6 py-3.5">Lokasi / Outlet</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Tidak ada pengguna yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleConfig = ROLE_CONFIG[u.role] || {
                    label: u.role,
                    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700'
                  };
                  const isCurrent = currentUser && currentUser._id === u._id;

                  return (
                    <tr key={u._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm">
                            {u.name ? u.name[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{u.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-medium">
                                  Anda
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border uppercase tracking-wider ${roleConfig.badgeClass}`}
                        >
                          {u.role === 'admin' ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                          ) : (
                            <Shield className="w-3.5 h-3.5" />
                          )}
                          {roleConfig.label}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{u.location_id?.name || 'Semua Lokasi / Pusat'}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            u.is_active
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                          }`}
                          title="Klik untuk ubah status aktif/nonaktif"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.is_active ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {u.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-purple-950/30 rounded-lg transition-colors"
                            title="Edit User & Role"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmUser(u)}
                            disabled={isCurrent}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isCurrent
                                ? 'text-slate-600 cursor-not-allowed'
                                : 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/30'
                            }`}
                            title={isCurrent ? 'Tidak bisa menghapus akun sendiri' : 'Hapus User'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Pengguna */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {editingUser ? 'Edit Pengguna & Hak Akses' : 'Tambah Pengguna Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="nama@baraja.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password {editingUser ? '(Kosongkan jika tidak diubah)' : '(Minimal 6 karakter)'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? '••••••••' : 'Buat password aman...'}
                    minLength={editingUser ? 0 : 6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Pilihan Peran / RBAC */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Peran / Role (RBAC)
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="admin">🛡️ Administrator (Akses Penuh Seluruh Modul & Approval)</option>
                  <option value="purchasing">🛒 Purchasing (Pengajuan Marketlist & Transaksi Belanja)</option>
                  <option value="receiver">📦 Receiver (Verifikasi Surat Jalan & Penerimaan Gudang)</option>
                  <option value="accounting">📊 Accounting (Invoices, Overhead, Laba Rugi)</option>
                  <option value="management">💼 Management (Analitik & Monitoring Eksekutif)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {ROLE_CONFIG[formData.role]?.description}
                </p>
              </div>

              {/* Lokasi / Outlet */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Penugasan Lokasi / Cabang
                </label>
                <select
                  value={formData.location_id}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Semua Lokasi / Kantor Pusat</option>
                  {locations.map((loc) => (
                    <option key={loc._id} value={loc._id}>
                      {loc.name} {loc.code ? `(${loc.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Aktif */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="user_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="user_active" className="text-sm text-slate-300 select-none">
                  Akun aktif dan diizinkan masuk ke sistem
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingUser ? 'Simpan Perubahan' : 'Buat Pengguna'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Delete User */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Hapus Pengguna</h3>
            </div>
            <p className="text-sm text-slate-300">
              Apakah Anda yakin ingin menghapus akun pengguna{' '}
              <strong className="text-white">{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})?
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg flex items-center gap-2"
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Hapus Pengguna</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
