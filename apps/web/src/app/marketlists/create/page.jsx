'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '../../../components/Navbar';
import Link from 'next/link';
import { api } from '../../../lib/api';
import {
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Send,
  Search,
  Layers,
  ShoppingBag,
  Tag,
  Lock,
  Info,
  PackagePlus,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function CreateMarketlistPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Quick Catalog / Category Browser state
  const [selectedItemType, setSelectedItemType] = useState('ALL'); // 'ALL' | 'perishable' | 'groceries'
  const [selectedCatalogCat, setSelectedCatalogCat] = useState('ALL');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(false); // Default collapsed di mobile agar layar bersih

  // Modal Tambah Produk Baru Manual ke DB
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    item_type: 'groceries',
    category_id: '',
    unit_id: '',
    estimated_price: ''
  });

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredDate, setRequiredDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState([
    {
      category_id: '',
      product_id: '',
      requested_qty: 1,
      unit_price: 0,
      notes: ''
    }
  ]);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
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

  // Group products by category name for optgroups
  const groupedProducts = useMemo(() => {
    const groups = {};
    products.forEach((p) => {
      const catName = p.category_id?.name || 'Lainnya / Tanpa Kategori';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(p);
    });
    return groups;
  }, [products]);

  // Extract unique category list from products + categories API
  const categoryList = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => {
      if (selectedItemType === 'ALL' || c.type === selectedItemType || c.type === 'all' || !c.type) {
        map.set(c._id, { id: c._id, name: c.name, type: c.type });
      }
    });
    products.forEach((p) => {
      if (selectedItemType === 'ALL' || p.item_type === selectedItemType) {
        if (p.category_id?._id && p.category_id?.name) {
          if (!map.has(p.category_id._id)) {
            map.set(p.category_id._id, { id: p.category_id._id, name: p.category_id.name, type: p.item_type });
          }
        }
      }
    });
    return Array.from(map.values());
  }, [categories, products, selectedItemType]);

  // Catalog filtered items
  const filteredCatalogProducts = useMemo(() => {
    return products.filter((p) => {
      const typeMatch = selectedItemType === 'ALL' || p.item_type === selectedItemType;
      const catMatch =
        selectedCatalogCat === 'ALL' ||
        p.category_id?._id === selectedCatalogCat ||
        p.category_id?.name === selectedCatalogCat;
      const searchMatch =
        !catalogSearch.trim() ||
        p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(catalogSearch.toLowerCase()));
      return typeMatch && catMatch && searchMatch;
    });
  }, [products, selectedItemType, selectedCatalogCat, catalogSearch]);

  const handleAddItem = (initialProduct = null) => {
    if (initialProduct) {
      const lastPrice =
        initialProduct.last_purchase_price && Number(initialProduct.last_purchase_price) > 0
          ? Number(initialProduct.last_purchase_price)
          : 0;

      const newItem = {
        category_id: initialProduct.category_id?._id || '',
        product_id: initialProduct._id,
        requested_qty: 1,
        unit_price: lastPrice,
        notes: ''
      };

      if (items.length === 1 && !items[0].product_id) {
        setItems([newItem]);
      } else {
        setItems([...items, newItem]);
      }
      showToast(`"${initialProduct.name}" ditambahkan ke daftar`);
    } else {
      setItems([
        ...items,
        {
          category_id: '',
          product_id: '',
          requested_qty: 1,
          unit_price: 0,
          notes: ''
        }
      ]);
    }
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      setItems([
        {
          category_id: '',
          product_id: '',
          requested_qty: 1,
          unit_price: 0,
          notes: ''
        }
      ]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleRowCategoryChange = (index, catId) => {
    const updated = [...items];
    updated[index].category_id = catId;
    if (updated[index].product_id && catId) {
      const prod = products.find((p) => p._id === updated[index].product_id);
      if (prod && prod.category_id?._id !== catId) {
        updated[index].product_id = '';
        updated[index].unit_price = 0;
      }
    }
    setItems(updated);
  };

  const handleProductSelect = (index, productId) => {
    const updated = [...items];
    const selectedProd = products.find((p) => p._id === productId);
    updated[index].product_id = productId;
    if (selectedProd) {
      if (selectedProd.category_id?._id) {
        updated[index].category_id = selectedProd.category_id._id;
      }
      updated[index].unit_price =
        selectedProd.last_purchase_price && Number(selectedProd.last_purchase_price) > 0
          ? Number(selectedProd.last_purchase_price)
          : 0;
    } else {
      updated[index].unit_price = 0;
    }
    setItems(updated);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const q = parseFloat(item.requested_qty) || 0;
      const p = parseFloat(item.unit_price) || 0;
      return sum + q * p;
    }, 0);
  };

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
        category_id: newProductForm.category_id || undefined,
        unit_id: newProductForm.unit_id || undefined,
        last_purchase_price: newProductForm.estimated_price ? Number(newProductForm.estimated_price) : 0
      };

      const res = await api.createProduct(payload);
      const createdProd = res.data;

      showToast(`Produk "${createdProd.name}" berhasil dibuat & ditambahkan!`);
      await loadMasterData();
      handleAddItem(createdProd);

      setNewProductForm({
        name: '',
        item_type: 'groceries',
        category_id: '',
        unit_id: '',
        estimated_price: ''
      });
      setShowAddProductModal(false);
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan produk baru', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSubmit = async (submitToLeader = false) => {
    const invalidItem = items.find((i) => !i.product_id || i.requested_qty <= 0);
    if (invalidItem) {
      showToast('Pilih barang dan pastikan kuantitas lebih dari 0 pada setiap baris!', 'error');
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
          notes: i.notes
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
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
      <Navbar title="Buat Marketlist Baru" />

      {/* Floating Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border transition-all ${
            notification.type === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}

      <main className="p-3 sm:p-6 md:p-8 space-y-4 max-w-5xl w-full mx-auto">
        {/* Top Navigation & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <Link
            href="/marketlists"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Daftar</span>
          </Link>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Draft</span>
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ajukan PO</span>
            </button>
          </div>
        </div>

        {/* Tanggal Kebutuhan Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Pengajuan
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Kebutuhan (Required)
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Katalog Cepat Collapsible Panel */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden shadow-xs">
          <div
            onClick={() => setShowCatalog(!showCatalog)}
            className="p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-amber-100/50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-amber-500 text-white rounded-lg">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                  Katalog Cepat & Tambah Produk
                </h4>
                <p className="text-[11px] text-slate-600">
                  {showCatalog ? 'Klik untuk sembunyikan katalog' : 'Buka katalog untuk memilih dari daftar produk'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddProductModal(true);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Produk Baru</span>
                <span className="sm:hidden">+ Baru</span>
              </button>
              {showCatalog ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </div>
          </div>

          {showCatalog && (
            <div className="p-3.5 pt-0 border-t border-amber-200/60 space-y-3 mt-1">
              {/* Filter Tipe Barang */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                <button
                  type="button"
                  onClick={() => { setSelectedItemType('ALL'); setSelectedCatalogCat('ALL'); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    selectedItemType === 'ALL'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Semua ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedItemType('perishable'); setSelectedCatalogCat('ALL'); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    selectedItemType === 'perishable'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  Perishable ({products.filter(p => p.item_type === 'perishable').length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedItemType('groceries'); setSelectedCatalogCat('ALL'); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    selectedItemType === 'groceries'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Groceries ({products.filter(p => p.item_type === 'groceries').length})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama barang di katalog..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Catalog Product Grid (Responsive: 1 col on mobile, 2 col on tablet, 3 col on desktop) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1 bg-white/70 rounded-xl border border-amber-100">
                {filteredCatalogProducts.length === 0 ? (
                  <div className="col-span-full py-6 text-center text-xs text-slate-500">
                    Tidak ada barang yang cocok. Silakan gunakan tombol <strong>+ Produk Baru</strong> di atas untuk membuat produk baru ke database.
                  </div>
                ) : (
                  filteredCatalogProducts.map((p) => {
                    const price = Number(p.last_purchase_price) || 0;
                    return (
                      <div
                        key={p._id}
                        className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                            <span className="bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                              {p.category_id?.name || 'Umum'}
                            </span>
                            <span>• {p.unit_id?.abbreviation || 'pcs'}</span>
                          </div>
                          <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                            {price > 0 ? `Rp ${price.toLocaleString('id-ID')}` : 'Rp 0'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddItem(p)}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shrink-0 shadow-xs"
                        >
                          + Pilih
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Daftar Barang Belanja (Clean Mobile Card Style) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Item Belanja ({items.length} Baris)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleAddItem()}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baris</span>
            </button>
          </div>

          {/* List of Item Cards (Mobile & Desktop Friendly) */}
          <div className="space-y-3">
            {items.map((row, idx) => {
              const availableRowProducts = row.category_id
                ? products.filter(
                    (p) =>
                      p.category_id?._id === row.category_id ||
                      p.category_id?.name === row.category_id
                  )
                : products;

              const selectedProd = products.find((p) => p._id === row.product_id);
              const subtotal = (Number(row.requested_qty) || 0) * (Number(row.unit_price) || 0);

              return (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3 transition-colors hover:border-slate-300"
                >
                  {/* Top Baris: Nomor & Hapus */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                      Baris #{idx + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors disabled:opacity-30"
                      title="Hapus baris ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Field Baris: Dropdown Kategori & Produk */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Filter Kategori */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Filter Kategori:
                      </label>
                      <select
                        value={row.category_id}
                        onChange={(e) => handleRowCategoryChange(idx, e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                      >
                        <option value="">Semua Kategori</option>
                        {categoryList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pilih Produk */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Pilih Nama Barang:
                      </label>
                      <select
                        value={row.product_id}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold"
                      >
                        <option value="">-- Pilih Barang --</option>
                        {row.category_id ? (
                          availableRowProducts.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name} ({p.unit_id?.abbreviation || 'pcs'})
                            </option>
                          ))
                        ) : (
                          Object.entries(groupedProducts).map(([catName, prods]) => (
                            <optgroup key={catName} label={`📁 ${catName}`}>
                              {prods.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name} ({p.unit_id?.abbreviation || 'pcs'})
                                </option>
                              ))}
                            </optgroup>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Field Kuantitas, Harga Satuan & Subtotal */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Kuantitas ({selectedProd?.unit_id?.abbreviation || 'Satuan'})
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={row.requested_qty}
                        onChange={(e) => handleItemChange(idx, 'requested_qty', e.target.value)}
                        className="w-full text-xs font-bold p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                        <span>Harga Satuan</span>
                        <Lock className="w-3 h-3 text-slate-400" />
                      </label>
                      <div className="w-full text-xs font-semibold p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 truncate">
                        {row.unit_price > 0 ? `Rp ${Number(row.unit_price).toLocaleString('id-ID')}` : 'Rp 0'}
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Subtotal Estimasi
                      </label>
                      <div className="w-full text-xs font-black p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                        Rp {subtotal.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tombol Tambah Baris Cepat di Bawah */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleAddItem()}
              className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Baris Belanja Baru</span>
            </button>
          </div>

          {/* Total Ringkasan */}
          <div className="p-4 bg-slate-100 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-600">Total Estimasi Pengajuan:</span>
              <p className="text-[10px] text-slate-400">Harga satuan akan diperbarui otomatis saat transaksi belanja dicatat</p>
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-700">
              Rp {calculateTotal().toLocaleString('id-ID')}
            </p>
          </div>

          {/* Catatan Dokumen */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Pengajuan (Opsional):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Kebutuhan mendesak untuk event weekend..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </main>

      {/* Modal Tambah Produk Baru Manual ke Database */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Tambah Produk Baru</h3>
                  <p className="text-[11px] text-slate-500">Tersimpan ke database & langsung dipilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
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
                  Estimasi Harga Awal (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 (opsional)"
                  value={newProductForm.estimated_price}
                  onChange={(e) => setNewProductForm({ ...newProductForm, estimated_price: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {savingProduct ? 'Menyimpan...' : 'Simpan & Masukkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
