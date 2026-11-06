'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Plus, Trash2, ArrowLeft, Save, Send } from 'lucide-react';

export default function CreateMarketlistPage() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredDate, setRequiredDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [locationId, setLocationId] = useState('');

  const [items, setItems] = useState([
    { product_id: '', requested_qty: 1, unit_price: 0, supplier_id: '', notes: '' }
  ]);

  useEffect(() => {
    async function initMasterData() {
      try {
        const [prodRes, suppRes] = await Promise.all([
          api.getProducts().catch(() => null),
          api.getSuppliers().catch(() => null)
        ]);
        if (prodRes?.data) setProducts(prodRes.data);
        if (suppRes?.data) setSuppliers(suppRes.data);
      } catch (err) {
        console.error('Failed to load master data', err);
      }
    }
    initMasterData();
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      { product_id: '', requested_qty: 1, unit_price: 0, supplier_id: '', notes: '' }
    ]);
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

  const handleProductSelect = (index, productId) => {
    const updated = [...items];
    const selectedProd = products.find((p) => p._id === productId);
    updated[index].product_id = productId;
    if (selectedProd) {
      if (selectedProd.last_purchase_price && Number(selectedProd.last_purchase_price) > 0) {
        updated[index].unit_price = Number(selectedProd.last_purchase_price);
      }
      const lastSuppId = selectedProd.last_supplier_id?._id || selectedProd.last_supplier_id;
      if (lastSuppId) {
        updated[index].supplier_id = lastSuppId;
      }
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
    // Validate
    const invalidItem = items.find((i) => !i.product_id || i.requested_qty <= 0);
    if (invalidItem) {
      alert('Pilih barang dan pastikan kuantitas lebih besar dari nol untuk semua baris!');
      return;
    }

    setLoading(true);
    try {
      // Pick first location if not set
      const payload = {
        date,
        required_date: requiredDate,
        location_id: locationId || '663673f8e538ef94b0000001', // fallback to sample location id
        items: items.map((i) => ({
          product_id: i.product_id,
          requested_qty: Number(i.requested_qty),
          unit_price: Number(i.unit_price) || 0,
          supplier_id: i.supplier_id || undefined,
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

      <main className="p-8 space-y-6 max-w-5xl">
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

        {/* Card Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Pembuatan</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Kebutuhan (Required)</label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-800">Daftar Barang Belanja (Marketlist Items)</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Baris Barang
              </button>
            </div>

            <div className="space-y-3">
              {items.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 items-end"
                >
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
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.unit_id?.abbreviation || 'KG'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Kuantitas
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={row.requested_qty}
                      onChange={(e) => handleItemChange(idx, 'requested_qty', e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Harga Satuan (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={row.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Supplier Pilihan
                    </label>
                    <select
                      value={row.supplier_id}
                      onChange={(e) => handleItemChange(idx, 'supplier_id', e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="">-- Rekomendasi Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="flex justify-end pt-3">
              <div className="text-right">
                <span className="text-xs text-slate-500">Estimasi Total Belanja:</span>
                <p className="text-xl font-black text-emerald-700">
                  Rp {calculateTotal().toLocaleString('id-ID')}
                </p>
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

