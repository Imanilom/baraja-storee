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
  Info
} from 'lucide-react';

export default function CreateMarketlistPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // Quick Catalog / Category Browser state
  const [selectedCatalogCat, setSelectedCatalogCat] = useState('ALL');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(true);

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

  useEffect(() => {
    async function initMasterData() {
      try {
        const [prodRes, catRes] = await Promise.all([
          api.getProducts().catch(() => null),
          api.getCategories().catch(() => null)
        ]);
        if (prodRes?.data) setProducts(prodRes.data);
        if (catRes?.data) setCategories(catRes.data);
      } catch (err) {
        console.error('Failed to load master data', err);
      }
    }
    initMasterData();
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
    categories.forEach((c) => map.set(c._id, c.name));
    products.forEach((p) => {
      if (p.category_id?._id && p.category_id?.name) {
        map.set(p.category_id._id, p.category_id.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [categories, products]);

  // Catalog filtered items
  const filteredCatalogProducts = useMemo(() => {
    return products.filter((p) => {
      const catMatch =
        selectedCatalogCat === 'ALL' ||
        p.category_id?._id === selectedCatalogCat ||
        p.category_id?.name === selectedCatalogCat;
      const searchMatch =
        !catalogSearch.trim() ||
        p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(catalogSearch.toLowerCase()));
      return catMatch && searchMatch;
    });
  }, [products, selectedCatalogCat, catalogSearch]);

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
    // If current selected product doesn't belong to the new category, reset it
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
      // Price strictly follows last transaction purchase price
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

  const handleSubmit = async (submitToAdmin = false) => {
    const invalidItem = items.find((i) => !i.product_id || i.requested_qty <= 0);
    if (invalidItem) {
      alert('Pilih barang dan pastikan kuantitas lebih besar dari nol untuk semua baris!');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        date,
        required_date: requiredDate,
        location_id: locationId || '663673f8e538ef94b0000001',
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
        alert('Marketlist berhasil dibuat dan langsung disubmit ke Admin!');
      } else {
        alert('Marketlist berhasil disimpan sebagai draft!');
      }

      window.location.href = '/marketlists';
    } catch (err) {
      alert(err.message || 'Gagal menyimpan Marketlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Buat Marketlist Baru" />

      <main className="p-8 space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
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
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Simpan Draft
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Submit ke Admin
            </button>
          </div>
        </div>

        {/* Info Banner: Kebijakan Supplier & Harga */}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 text-xs text-blue-900">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Ketentuan Pengajuan Marketlist:</p>
            <p className="text-blue-800/90 leading-relaxed">
              1. <strong>Tanpa Memilih Supplier:</strong> Supplier akan dipilih dan ditentukan langsung oleh <strong>Tim Purchasing</strong> saat proses transaksi belanja di web.
              <br />
              2. <strong>Harga Satuan Terkunci:</strong> Harga satuan otomatis mengikuti harga terakhir dari transaksi belanja sebelumnya dan tidak dapat diedit manual saat pengajuan.
            </p>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Pembuatan
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Kebutuhan (Required)
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* Quick Add per Category Panel */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500 text-white rounded-lg">
                  <Layers className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">
                    Pilih Cepat Barang per Kategori
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Kelompokkan barang berdasarkan kategori untuk mempermudah pencarian
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalog(!showCatalog)}
                className="text-xs text-amber-800 font-semibold underline hover:text-amber-950"
              >
                {showCatalog ? 'Tutup Panel Katalog' : 'Buka Panel Katalog'}
              </button>
            </div>

            {showCatalog && (
              <div className="space-y-3 pt-2">
                {/* Search & Category Filter Pills */}
                <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-1.5 items-center w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogCat('ALL')}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        selectedCatalogCat === 'ALL'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-amber-100 border border-slate-200'
                      }`}
                    >
                      Semua Kategori ({products.length})
                    </button>
                    {categoryList.map((cat) => {
                      const count = products.filter(
                        (p) =>
                          p.category_id?._id === cat.id ||
                          p.category_id?.name === cat.name
                      ).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCatalogCat(cat.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${
                            selectedCatalogCat === cat.id
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-amber-100 border border-slate-200'
                          }`}
                        >
                          <Tag className="w-3 h-3 opacity-60" />
                          {cat.name} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Search box */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama barang..."
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
                      Tidak ada barang di kategori ini yang cocok dengan pencarian.
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
                            <div className="font-semibold text-slate-800 truncate">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-600">
                                {p.category_id?.name || 'Tanpa Kategori'}
                              </span>
                              <span>Satuan: {p.unit_id?.abbreviation || 'KG'}</span>
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
                            {isAlreadyInItems ? '+ Lagi' : 'Tambah'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-800">
                  Daftar Barang Belanja ({items.length} Baris)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Baris Kosong
              </button>
            </div>

            <div className="space-y-3">
              {items.map((row, idx) => {
                // Filter products for this row if row.category_id is selected
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
                    className="grid grid-cols-12 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 items-end"
                  >
                    {/* Category Filter per row (Col 3) */}
                    <div className="col-span-3">
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
                    <div className="col-span-4">
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
                          // If category is filtered, show direct list
                          availableRowProducts.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name} ({p.unit_id?.abbreviation || 'KG'})
                            </option>
                          ))
                        ) : (
                          // If all categories, group with <optgroup>
                          Object.entries(groupedProducts).map(([catName, prods]) => (
                            <optgroup key={catName} label={`📁 ${catName}`}>
                              {prods.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name} ({p.unit_id?.abbreviation || 'KG'})
                                </option>
                              ))}
                            </optgroup>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Quantity (Col 2) */}
                    <div className="col-span-2">
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

                    {/* Harga Satuan Terakhir (Col 2) - Read Only & Locked */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                        <span>Harga Satuan (Rp)</span>
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
                        title="Harga otomatis dari transaksi pembelian terakhir dan tidak dapat diedit"
                        className="w-full text-xs p-2 bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-none"
                      />
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        Terkunci dari transaksi
                      </span>
                    </div>

                    {/* Action Remove (Col 1) */}
                    <div className="col-span-1 flex justify-center pb-3">
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
                );
              })}
            </div>

            {/* Total Summary */}
            <div className="flex justify-end pt-3">
              <div className="text-right">
                <span className="text-xs text-slate-500">Estimasi Total Belanja:</span>
                <p className="text-xl font-black text-emerald-700">
                  Rp {calculateTotal().toLocaleString('id-ID')}
                </p>
                <span className="text-[10px] text-slate-400">
                  *Total dihitung dari harga transaksi terakhir
                </span>
              </div>
            </div>
          </div>

          {/* Single Note Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Marketlist (Satu Catatan per Dokumen):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan kebutuhan khusus, instruksi pengiriman, dll."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
