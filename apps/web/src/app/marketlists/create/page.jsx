'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Navbar from '../../../components/Navbar';
import Link from 'next/link';
import { api } from '../../../lib/api';
import {
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  Save,
  Send,
  Search,
  ShoppingBag,
  PackagePlus,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Tag,
  Calendar,
  FileText
} from 'lucide-react';

export default function CreateMarketlistPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL'); // 'ALL' | 'perishable' | 'groceries'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showMeta, setShowMeta] = useState(false); // Collapsible date & general notes on mobile

  // Modal Tambah Produk Baru
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    item_type: 'groceries',
    department: '',
    category_id: '',
    unit_id: '',
    estimated_price: ''
  });

  // Dates & Notes
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredDate, setRequiredDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');

  // Added Items List
  const [items, setItems] = useState([]);

  const searchInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadMasterData = async () => {
    try {
      const [prodRes, catRes, unitRes] = await Promise.all([
        api.getProducts().catch(() => null),
        api.getCategories().catch(() => null),
        api.getUnits().catch(() => null)
      ]);
      if (prodRes?.data) setProducts(prodRes.data);
      if (catRes?.data) setCategories(catRes.data);
      if (unitRes?.data) setUnits(unitRes.data);
    } catch (err) {
      console.error('Failed to load master data', err);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Filter products for fast live search & browsing
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const term = searchTerm.trim().toLowerCase();

    return products.filter((p) => {
      // Type filter (Perishable vs Groceries)
      const typeMatch = selectedType === 'ALL' || p.item_type === selectedType;
      // Category filter
      const catMatch =
        selectedCategory === 'ALL' ||
        p.category_id?._id === selectedCategory ||
        p.category_id?.name === selectedCategory;
      // Search term
      const searchMatch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.category_id?.name && p.category_id.name.toLowerCase().includes(term));

      return typeMatch && catMatch && searchMatch;
    });
  }, [products, searchTerm, selectedType, selectedCategory]);

  // Check how many items of a product are currently added
  const getItemQty = (productId) => {
    const existing = items.find((i) => i.product_id === productId);
    return existing ? existing.requested_qty : 0;
  };

  // Quick add / increment from search results
  const handleAddProduct = (product) => {
    const existingIndex = items.findIndex((i) => i.product_id === product._id);

    if (existingIndex > -1) {
      // If already added, increment qty by 1
      const updated = [...items];
      updated[existingIndex].requested_qty = Number((updated[existingIndex].requested_qty + 1).toFixed(2));
      setItems(updated);
      showToast(`+1 "${product.name}" (Total: ${updated[existingIndex].requested_qty})`);
    } else {
      // Add new item
      const unitPrice =
        product.last_purchase_price && Number(product.last_purchase_price) > 0
          ? Number(product.last_purchase_price)
          : 0;

      const newItem = {
        product_id: product._id,
        product: product,
        requested_qty: 1,
        unit_price: unitPrice,
        notes: ''
      };

      setItems([newItem, ...items]);
      showToast(`"${product.name}" ditambahkan ke daftar`);
    }
  };

  // Update item field
  const handleUpdateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Adjust qty with stepper
  const handleStepQty = (index, delta) => {
    const updated = [...items];
    const current = Number(updated[index].requested_qty) || 0;
    const next = Math.max(0.1, Number((current + delta).toFixed(2)));
    updated[index].requested_qty = next;
    setItems(updated);
  };

  // Remove item
  const handleRemoveItem = (index) => {
    const removedName = items[index]?.product?.name || 'Item';
    setItems(items.filter((_, i) => i !== index));
    showToast(`"${removedName}" dihapus dari daftar`, 'info');
  };

  // Calculate totals
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const q = parseFloat(item.requested_qty) || 0;
      const p = parseFloat(item.unit_price) || 0;
      return sum + q * p;
    }, 0);
  }, [items]);

  // Handle modal create new product
  const handleCreateNewProduct = async (e) => {
    e.preventDefault();
    if (!newProductForm.name.trim()) {
      showToast('Nama produk wajib diisi', 'error');
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        name: newProductForm.name.trim(),
        item_type: newProductForm.item_type,
        department: newProductForm.department || null,
        category_id: newProductForm.category_id || undefined,
        unit_id: newProductForm.unit_id || undefined,
        last_purchase_price: newProductForm.estimated_price ? Number(newProductForm.estimated_price) : 0
      };

      const res = await api.createProduct(payload);
      const createdProd = res.data;

      showToast(`Produk "${createdProd.name}" berhasil dibuat & ditambahkan!`);
      await loadMasterData();
      handleAddProduct(createdProd);

      setNewProductForm({
        name: '',
        item_type: 'groceries',
        department: '',
        category_id: '',
        unit_id: '',
        estimated_price: ''
      });
      setShowAddProductModal(false);
      setSearchTerm('');
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan produk baru', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  // Submit Marketlist
  const handleSubmit = async (submitToLeader = false) => {
    if (items.length === 0) {
      showToast('Daftar belanja masih kosong! Silakan pilih barang terlebih dahulu.', 'error');
      if (searchInputRef.current) searchInputRef.current.focus();
      return;
    }

    const invalidItem = items.find((i) => !i.product_id || i.requested_qty <= 0);
    if (invalidItem) {
      showToast('Pastikan semua kuantitas barang lebih dari 0!', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        date,
        required_date: requiredDate,
        items: items.map((i) => ({
          product_id: i.product_id,
          requested_qty: Number(i.requested_qty),
          unit_price: Number(i.unit_price) || 0,
          notes: i.notes || ''
        })),
        notes
      };

      const res = await api.createMarketlist(payload);
      if (submitToLeader && res?.data?._id) {
        await api.submitMarketlist(res.data._id);
        showToast('Marketlist berhasil diajukan ke Leader / Admin!');
      } else {
        showToast('Marketlist berhasil disimpan sebagai draft!');
      }

      setTimeout(() => {
        window.location.href = '/marketlists';
      }, 1000);
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan Marketlist', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 pb-28 sm:pb-24">
      <Navbar title="Buat Marketlist Baru" />

      {/* Floating Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 left-4 sm:left-auto z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
            notification.type === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : notification.type === 'info'
              ? 'bg-slate-800 text-white border-slate-700'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span className="flex-1">{notification.message}</span>
        </div>
      )}

      <main className="p-3 sm:p-6 md:p-8 space-y-3.5 max-w-4xl w-full mx-auto">
        
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/marketlists"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </Link>

          <button
            type="button"
            onClick={() => setShowMeta(!showMeta)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tgl Butuh: {new Date(requiredDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
            {showMeta ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Meta Form (Dates & Global Notes) */}
        {showMeta && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 animate-fade-in text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tanggal Pengajuan
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tanggal Kebutuhan (Wajib)
                </label>
                <input
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Catatan Pengajuan (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Kebutuhan mendesak untuk event akhir pekan..."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        {/* SEARCH & PICK BAR - FAST & INTUITIVE */}
        <div className="bg-white rounded-2xl border-2 border-emerald-500/40 p-3.5 sm:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              <span>Cari & Pilih Barang Belanja</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setNewProductForm({ ...newProductForm, name: searchTerm });
                setShowAddProductModal(true);
              }}
              className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>+ Produk Baru</span>
            </button>
          </div>

          {/* Search Input Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ketik nama barang (misal: Bawang, Ayam, Minyak, Telur...)"
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => { setSelectedType('ALL'); setSelectedCategory('ALL'); }}
              className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
                selectedType === 'ALL' && selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({products.length})
            </button>
            <button
              type="button"
              onClick={() => { setSelectedType('perishable'); setSelectedCategory('ALL'); }}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition flex items-center gap-1 ${
                selectedType === 'perishable'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              🥩 Perishable ({products.filter(p => p.item_type === 'perishable').length})
            </button>
            <button
              type="button"
              onClick={() => { setSelectedType('groceries'); setSelectedCategory('ALL'); }}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition flex items-center gap-1 ${
                selectedType === 'groceries'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              🌾 Groceries ({products.filter(p => p.item_type === 'groceries').length})
            </button>

            {/* Sub-category dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-semibold shrink-0 focus:outline-none"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Live Search & Match Results Grid (Max 6 visible at once for clean mobile feel) */}
          {(searchTerm.trim() || selectedType !== 'ALL' || selectedCategory !== 'ALL') && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Hasil Pencarian ({filteredProducts.length} barang):</span>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewProductForm({ ...newProductForm, name: searchTerm });
                      setShowAddProductModal(true);
                    }}
                    className="text-emerald-700 hover:underline"
                  >
                    + Buat "{searchTerm}"
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-slate-50/60 rounded-xl border border-slate-200">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full py-6 text-center text-xs text-slate-500 space-y-2">
                    <p>Barang <strong>"{searchTerm}"</strong> tidak ditemukan di database.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setNewProductForm({ ...newProductForm, name: searchTerm });
                        setShowAddProductModal(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs inline-flex items-center gap-1"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span>+ Tambah Sebagai Produk Baru</span>
                    </button>
                  </div>
                ) : (
                  filteredProducts.slice(0, 20).map((p) => {
                    const price = Number(p.last_purchase_price) || 0;
                    const unit = p.unit_id?.abbreviation || p.unit_id?.name || 'pcs';
                    const qtyAdded = getItemQty(p._id);

                    return (
                      <div
                        key={p._id}
                        onClick={() => handleAddProduct(p)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                          qtyAdded > 0
                            ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-bold text-slate-900 truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                            <span className="bg-slate-100 px-1.5 py-0.2 rounded font-medium truncate">
                              {p.category_id?.name || 'Umum'}
                            </span>
                            <span>• {unit}</span>
                            <span className="font-bold text-emerald-700">
                              {price > 0 ? `Rp ${price.toLocaleString('id-ID')}` : 'Rp 0'}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {qtyAdded > 0 ? (
                            <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-xs">
                              <span>✓ {qtyAdded} {unit}</span>
                              <Plus className="w-3 h-3 ml-0.5" />
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-900 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition">
                              <Plus className="w-3 h-3" />
                              <span>Pilih</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* DAFTAR BELANJA (SELECTED ITEMS) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Daftar Belanja
              </h3>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                {items.length} Barang
              </span>
            </div>

            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Kosongkan semua daftar belanja?')) setItems([]);
                }}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800"
              >
                Kosongkan
              </button>
            )}
          </div>

          {/* Empty State */}
          {items.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="max-w-xs mx-auto">
                <h4 className="font-bold text-sm text-slate-800">Daftar Belanja Masih Kosong</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Ketik nama barang di kotak pencarian di atas untuk menambahkan barang belanjaan.
                </p>
              </div>
            </div>
          ) : (
            /* Items List (Mobile-Optimized Cards) */
            <div className="space-y-2.5">
              {items.map((it, idx) => {
                const prod = it.product || products.find((p) => p._id === it.product_id) || {};
                const unit = prod.unit_id?.abbreviation || prod.unit_id?.name || 'pcs';
                const subtotal = (Number(it.requested_qty) || 0) * (Number(it.unit_price) || 0);

                return (
                  <div
                    key={it.product_id || idx}
                    className="p-3 sm:p-3.5 bg-slate-50/90 hover:bg-slate-50 rounded-xl border border-slate-200 transition-all space-y-2.5"
                  >
                    {/* Top Row: Product Name, Category & Trash */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900">
                            {prod.name || 'Barang'}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                            {prod.category_id?.name || 'Umum'}
                          </span>
                          {prod.item_type === 'perishable' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                              🥩 Segar
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Estimasi: Rp {Number(it.unit_price || 0).toLocaleString('id-ID')} / {unit}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                        title="Hapus barang ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Middle Row: Stepper Qty & Subtotal */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200/60">
                      {/* Touch Stepper for Mobile */}
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleStepQty(idx, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold active:scale-95 transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={it.requested_qty}
                          onChange={(e) => handleUpdateItem(idx, 'requested_qty', e.target.value)}
                          className="w-14 sm:w-16 text-center text-xs font-black text-slate-900 bg-transparent focus:outline-none"
                        />

                        <span className="text-[11px] font-bold text-slate-500 pr-1">{unit}</span>

                        <button
                          type="button"
                          onClick={() => handleStepQty(idx, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold active:scale-95 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Subtotal Display */}
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Subtotal</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-700">
                          Rp {subtotal.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Optional Note Row */}
                    <div>
                      <input
                        type="text"
                        value={it.notes || ''}
                        onChange={(e) => handleUpdateItem(idx, 'notes', e.target.value)}
                        placeholder="Catatan belanja khusus (misal: yang segar / merk Bimoli)..."
                        className="w-full text-[11px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* STICKY BOTTOM ACTION BAR (SUPER CONVENIENT ON MOBILE & DESKTOP) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              Total ({items.length} barang):
            </span>
            <span className="text-base sm:text-xl font-black text-emerald-700 leading-tight block">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={loading || items.length === 0}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simpan Draft</span>
              <span className="sm:hidden">Draft</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={loading || items.length === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg transition disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ajukan PO</span>
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL TAMBAH PRODUK BARU */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Tambah Produk Baru</h3>
                  <p className="text-[11px] text-slate-500">Tersimpan ke database & langsung terpilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Produk / Bahan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bawang Goreng 500g"
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Klasifikasi Barang:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProductForm({ ...newProductForm, item_type: 'groceries' })}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                      newProductForm.item_type === 'groceries'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🌾 Groceries (Kering)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProductForm({ ...newProductForm, item_type: 'perishable' })}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                      newProductForm.item_type === 'perishable'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🥩 Perishable (Basah)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bagian Penggunaan
                </label>
                <select
                  value={newProductForm.department}
                  onChange={(e) => setNewProductForm({ ...newProductForm, department: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                >
                  <option value="">Belum ditentukan</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="bar">Bar</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kategori
                </label>
                <select
                  value={newProductForm.category_id}
                  onChange={(e) => setNewProductForm({ ...newProductForm, category_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                >
                  <option value="">Pilih Kategori (Opsional)</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Satuan Unit (Default: pcs / kg)
                </label>
                <select
                  value={newProductForm.unit_id}
                  onChange={(e) => setNewProductForm({ ...newProductForm, unit_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                >
                  <option value="">Pilih Satuan (Opsional)</option>
                  {units.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Estimasi Harga Beli (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newProductForm.estimated_price}
                  onChange={(e) =>
                    setNewProductForm({ ...newProductForm, estimated_price: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                >
                  {savingProduct ? 'Menyimpan...' : 'Simpan & Tambahkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
