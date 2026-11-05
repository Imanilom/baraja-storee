'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import { Truck, CheckCircle2, AlertTriangle, FileText, Smartphone } from 'lucide-react';

export default function ReceivingMonitorPage() {
  const [activeMarketlists, setActiveMarketlists] = useState([]);
  const [selectedMl, setSelectedMl] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReceivingMl() {
      setLoading(true);
      try {
        const res = await api.getMarketlists('?limit=20');
        if (res?.data?.items) {
          // Filter to approved / in receiving
          const filtered = res.data.items.filter((m) =>
            ['approved', 'in_progress', 'partially_received', 'received'].includes(m.status)
          );
          setActiveMarketlists(filtered);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadReceivingMl();
  }, []);

  const handleSelectMarketlist = async (ml) => {
    try {
      const [detailRes, receiptRes] = await Promise.all([
        api.getMarketlistById(ml._id),
        api.getReceiptsByMarketlist(ml._id).catch(() => ({ data: [] }))
      ]);
      setSelectedMl(detailRes.data);
      setReceipts(receiptRes?.data || []);
    } catch (err) {
      alert('Gagal memuat detail penerimaan');
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Monitoring Surat Jalan Digital & Penerimaan Barang" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Banner rule 1 */}
        <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Operasional Penerimaan Lapangan (Mobile App)</h3>
            </div>
            <p className="text-xs text-slate-400">
              Aturan Pokok #1: Aplikasi Mobile difokuskan khusus untuk petugas gudang sebagai <strong>Surat Jalan Digital</strong> penerimaan barang fisik bertahap.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            Realtime Sync Active
          </span>
        </div>

        {/* Master-Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Active Marketlists list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Marketlist Siap Diterima:
            </h3>

            <div className="space-y-2">
              {activeMarketlists.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  {loading ? 'Memuat data...' : 'Belum ada Marketlist yang disetujui untuk penerimaan.'}
                </p>
              ) : (
                activeMarketlists.map((ml) => (
                  <button
                    key={ml._id}
                    onClick={() => handleSelectMarketlist(ml)}
                    className={`w-full p-3 text-left rounded-xl border text-xs transition-all ${
                      selectedMl?._id === ml._id
                        ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                      <span>{ml.marketlist_number}</span>
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-white border font-bold text-emerald-700">
                        {ml.status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      Kebutuhan: {new Date(ml.required_date || ml.date).toLocaleDateString('id-ID')}
                    </p>
                    <p className="text-slate-600 font-semibold mt-1">
                      {ml.totals?.total_items} jenis barang &bull; Rp {(ml.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Receiving History & Checklist Details */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedMl ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400 text-xs">
                Pilih salah satu Marketlist di sebelah kiri untuk melihat histori surat jalan dan verifikasi kuantitas.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Surat Jalan Digital: {selectedMl.marketlist_number}
                    </h3>
                    <p className="text-slate-500">Status Dokumen: {selectedMl.status?.toUpperCase()}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs">
                    {receipts.length} Kali Pengiriman Tercatat
                  </span>
                </div>

                {/* Checklist table */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Item Kebutuhan vs Penerimaan Kumulatif:</h4>
                  <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Nama Barang</th>
                        <th className="p-2.5">Dipesan</th>
                        <th className="p-2.5">Supplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedMl.items?.map((item) => (
                        <tr key={item._id}>
                          <td className="p-2.5 font-bold text-slate-800">
                            {item.product_snapshot?.name || item.product_id?.name}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-700">
                            {item.requested_qty} {item.product_snapshot?.unit_name}
                          </td>
                          <td className="p-2.5 text-slate-600">{item.supplier_id?.name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Surat Jalan Receipts Log */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800">Bukti Surat Jalan & Checklist Datang:</h4>
                  {receipts.length === 0 ? (
                    <p className="p-4 bg-slate-50 rounded-xl text-slate-400 text-center">
                      Belum ada penerimaan yang diinput oleh petugas receiver mobile.
                    </p>
                  ) : (
                    receipts.map((rcv) => (
                      <div key={rcv._id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span className="text-emerald-700">{rcv.receipt_number}</span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            {new Date(rcv.received_at).toLocaleString('id-ID')} &bull; Petugas: {rcv.received_by?.name}
                          </span>
                        </div>
                        <p className="text-slate-600 italic">Kondisi: {rcv.general_condition || 'Normal'}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          {rcv.items?.map((it, idx) => (
                            <div key={idx} className="p-2 bg-white rounded border border-slate-200 text-[11px] space-y-1">
                              <div className="flex justify-between font-bold">
                                <span>{it.marketlist_item_id?.product_snapshot?.name || 'Item'}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] ${it.status === 'complete' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {it.status}
                                </span>
                              </div>
                              <p className="text-slate-500">
                                Diterima: {it.received_qty} &bull; Layak: <strong className="text-emerald-700">{it.accepted_qty}</strong> &bull; Ditolak: <strong className="text-rose-600">{it.rejected_qty}</strong>
                              </p>
                              {it.item_note && <p className="text-slate-400 italic">Catatan: {it.item_note}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
