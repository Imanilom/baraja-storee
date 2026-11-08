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
  AlertCircle
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
  const [showCatalog, setShowCatalog] = useState(true);

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
  const [locationId, setLocationId] = useState('');

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

  // Group products by category name for display & optgroups
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

      // If the first row is empty, replace it; otherwise append
      if (items.length === 1 && !items[0].product_id) {
        setItems([newItem]);
      } else {
        setItems([...items, newItem]);
      }
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
    if (items.length <= 1) return;
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

  // Simpan Produk Baru Manual ke Database & Otomatis Tambah ke Marketlist
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

      showToast(`Produk "${createdProd.name}" berhasil ditambahkan ke database!`);

      // Refresh master data produk
      await loadMasterData();

      // Langsung masukkan ke baris belanja
      handleAddItem(createdProd);

      // Reset form dan tutup modal
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

  const handleSubmit = async (submitToAdmin = false) => {
    const invalidItem = items.find((i) => !i.product_id || i.requested_qty <= 0);
    if (invalidItem) {
      showToast('Pilih barang dan pastikan kuantitas lebih besar dari 0 untuk semua baris!', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        date,
        required_date: requiredDate,
        location_id: locationId || undefined,
        items: items.map((i) => ({
          product_id: i.product_id,
          requested_qty: Number(i.requested_qty),
          unit_price: Number(i.unit_price) || 0,
          notes: i.notes
        })),
        notes
      };

      const res = await api.createMarketlist(payload);
      if (submitToAdmin && res?.data?._id) {
        await api.submitMarketlist(res.data._id);
        showToast('Marketlist berhasil dibuat dan diajukan ke Leader / Admin!');
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
    <div className="flex-1 flex flex-col min-w-0">
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

      <main className="p-4 sm:p-6 md:p-8 space-y-5 max-w-6xl w-full">
        {/* Top Header Actions (Mobile Friendly) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href="/marketlists"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Simpan Draft
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Ajukan ke Leader / Admin
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 p-3.5 sm:p-4 rounded-xl flex items-start gap-3 text-xs text-blue-900">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Ketentuan Pengajuan Marketlist:</p>
            <p className="text-blue-800/90 leading-relaxed text-[11px] sm:text-xs">
              • <strong>Produk Baru:</strong> Anda dapat menambah produk baru langsung dari tombol di bawah dan otomatis disimpan ke database.
              <br />
              • <strong>Pembaruan Harga:</strong> Harga satuan produk akan diperbarui otomatis saat pencatatan transaksi pembelian belanja riil oleh Purchasing.
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6">
          {/* Header Info (Tanggal) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Pengajuan
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Kebutuhan (Required Date)
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Quick Add per Category Panel */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500 text-white rounded-lg">
                  <Layers className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">
                    Katalog Produk & Filter Kategori
                  </h4>
                  <p className="text-[11px] text-slate-500 hidden sm:block">
                    Pilih cepat barang dari database atau tambah manual
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  + Tambah Produk Manual
                </button>
                <button
                  type="button"
                  onClick={() => setShowCatalog(!showCatalog)}
                  className="text-xs text-amber-800 font-semibold underline hover:text-amber-950 ml-1"
                >
                  {showCatalog ? 'Sembunyikan' : 'Buka'}
                </button>
              </div>
            </div>

            {showCatalog && (
              <div className="space-y-3 pt-2">
                {/* 1. Filter Tipe Barang (Perishable vs Groceries) */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pb-2 border-b border-amber-200/60">
                  <span className="text-xs font-bold text-slate-700 mr-1">Tipe:</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedItemType('ALL'); setSelectedCatalogCat('ALL'); }}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition ${
                      selectedItemType === 'ALL'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Semua ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedItemType('perishable'); setSelectedCatalogCat('ALL'); }}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedItemType === 'perishable'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    Perishable / Basah ({products.filter(p => p.item_type === 'perishable').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedItemType('groceries'); setSelectedCatalogCat('ALL'); }}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedItemType === 'groceries'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Groceries / Kering ({products.filter(p => p.item_type === 'groceries').length})
                  </button>
                </div>

                {/* 2. Search & Category Filter Pills */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                  {/* Category Pills (horizontally scrollable on mobile) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogCat('ALL')}
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                        selectedCatalogCat === 'ALL'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-amber-100 border border-slate-200'
                      }`}
                    >
                      Semua Kategori
                    </button>
                    {categoryList.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCatalogCat(cat.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${
                          selectedCatalogCat === cat.id
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-amber-100 border border-slate-200'
                        }`}
                      >
                        <Tag className="w-3 h-3 opacity-60" />
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  {/* Search box */}
                  <div className="relative w-full sm:w-64 shrink-0">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari barang..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Catalog Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1 bg-white/70 rounded-xl border border-amber-100">
                  {filteredCatalogProducts.length === 0 ? (
                    <div className="col-span-full py-6 text-center text-xs text-slate-400">
                      Tidak ada barang di kategori ini. Anda dapat menambahkan produk baru secara manual.
                    </div>
                  ) : (
                    filteredCatalogProducts.map((p) => {
                      const isAlreadyInItems = items.some((i) => i.product_id === p._id);
                      const price = Number(p.last_purchase_price) || 0;

                      return (
                        <div
                          key={p._id}
                          className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 hover:border-amber-400 hover:shadow-xs transition-all text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {p.item_type === 'perishable' ? (
                                <span className="bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                  Perishable
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                  Groceries
                                </span>
                              )}
                              <span className="font-semibold text-slate-800 truncate">
                                {p.name}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-600">
                                {p.category_id?.name || 'Tanpa Kategori'}
                              </span>
                              <span>Satuan: {p.unit_id?.abbreviation || 'pcs'}</span>
                            </div>
                            <div className="text-[10px] text-amber-800 font-bold mt-0.5 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5 opacity-60" />
                              {price > 0
                                ? `Rp ${price.toLocaleString('id-ID')} (Harga Terakhir)`
                                : 'Rp 0 (Belum ada riwayat transaksi)'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddItem(p)}
                            className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors ${
                              isAlreadyInItems
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-amber-500 hover:bg-amber-600 text-white'
                            }`}
                            title="Tambahkan ke daftar belanja"
                          >
                            <Plus className="w-3 h-3" />
                            {isAlreadyInItems ? '+ Lagi' : 'Pilih'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Items Section (Responsive Mobile Cards & Desktop Grid) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-800">
                  Daftar Barang Belanja ({items.length} Baris)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 mr-2"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  + Produk Baru
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Baris
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((row, idx) => {
                const availableRowProducts = row.category_id
                  ? products.filter(
                      (p) =>
                        p.category_id?._id === row.category_id ||
                        p.category_id?.name === row.category_id
                    )
                  : products;

                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-end"
                  >
                    {/* Category Filter (Col 3) */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Filter Kategori
                      </label>
                      <select
                        value={row.category_id}
                        onChange={(e) => handleRowCategoryChange(idx, e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">Semua Kategori</option>
                        {categoryList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Product Selector with grouped <optgroup> (Col 4) */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Nama Barang Master
                      </label>
                      <select
                        value={row.product_id}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                      {row.product_id && (
                        <div className="mt-1 flex items-center gap-1">
                          {products.find((p) => p._id === row.product_id)?.item_type === 'perishable' ? (
                            <span className="text-[9px] font-bold text-rose-700 bg-rose-100/70 border border-rose-200 px-1.5 py-0.5 rounded">
                              ● Perishable (Barang Basah)
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded">
                              ● Groceries (Barang Kering)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Mobile Wrapper for Quantity, Price & Remove Button */}
                    <div className="flex items-center gap-2 sm:contents">
                      {/* Quantity (Col 2) */}
                      <div className="flex-1 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Kuantitas
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={row.requested_qty}
                          onChange={(e) =>
                            handleItemChange(idx, 'requested_qty', e.target.value)
                          }
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Harga Satuan Terakhir (Col 2) - Read Only */}
                      <div className="flex-1 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                          <span>Harga Satuan</span>
                          <Lock className="w-2.5 h-2.5 text-slate-400" />
                        </label>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={
                            row.unit_price > 0
                              ? `Rp ${Number(row.unit_price).toLocaleString('id-ID')}`
                              : 'Rp 0'
                          }
                          title="Harga otomatis dari transaksi pembelian terakhir dan diupdate saat belanja"
                          className="w-full text-xs p-2 bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-none"
                        />
                      </div>

                      {/* Action Remove (Col 1) */}
                      <div className="sm:col-span-1 flex justify-center pb-0 sm:pb-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={items.length <= 1}
                          className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Summary */}
            <div className="flex justify-end pt-3">
              <div className="text-right">
                <span className="text-xs text-slate-500">Estimasi Total Pengajuan:</span>
                <p className="text-xl font-black text-emerald-700">
                  Rp {calculateTotal().toLocaleString('id-ID')}
                </p>
                <span className="text-[10px] text-slate-400">
                  *Harga satuan akan diperbarui otomatis saat pencatatan transaksi belanja riil
                </span>
              </div>
            </div>
          </div>

          {/* Single Note Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Pengajuan Marketlist:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan kebutuhan khusus, instruksi pengiriman, dsb."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </main>

      {/* Modal Tambah Produk Baru Manual ke Database */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Tambah Produk Baru</h3>
                  <p className="text-[11px] text-slate-400">Tersimpan ke database & langsung ditambahkan</p>
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
              {/* Nama Produk */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Produk / Barang *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bawang Merah Brebes / Susu UHT 1L"
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              {/* Tipe Barang */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Klasifikasi / Tipe Barang
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

              {/* Kategori */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
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

              {/* Satuan Unit */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
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

              {/* Estimasi Harga Awal */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Estimasi Harga Awal (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 (opsional - harga resmi diupdate saat belanja)"
                  value={newProductForm.estimated_price}
                  onChange={(e) => setNewProductForm({ ...newProductForm, estimated_price: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  *Harga ini hanya acuan estimasi. Harga satuan resmi produk akan di-update otomatis ketika pencatatan transaksi belanja.
                </p>
              </div>

              {/* Action Buttons */}
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
