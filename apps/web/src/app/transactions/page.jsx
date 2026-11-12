'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import {
  ShoppingCart, Plus, Eye, X, Package, Calendar, CreditCard,
  FileText, Store, ClipboardList, AlertTriangle, CheckCircle2,
  Wallet, AlertOctagon, Clock, TrendingDown, ChevronRight, Banknote,
  Truck, RotateCcw, Sparkles, Check, Pencil, Trash2
} from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Kas Tunai (Uang Cash Fisik)' },
  { value: 'transfer', label: '🏦 Transfer Bank (Rekening)' },
  { value: 'tempo', label: '⏳ Tempo / Hutang Kredit' }
];

const paymentBadge = (method) => {
  const map = {
    cash: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    transfer: 'bg-blue-100 text-blue-800 border border-blue-300',
    tempo: 'bg-amber-100 text-amber-800 border border-amber-300'
  };
  return map[method] || 'bg-slate-100 text-slate-600';
};

const paymentLabel = (method, source) => {
  if (method === 'cash') return source === 'petty_cash' ? '🪙 Kas Kecil' : '💵 Kas Tunai';
  if (method === 'transfer') return '🏦 Rekening Bank';
  if (method === 'tempo') {
    const sourceLabel = source === 'petty_cash' ? 'Kas Kecil' : source === 'bank' ? 'Rekening Bank' : 'Kas Tunai';
    return `⏳ Tempo / Hutang (${sourceLabel})`;
  }
  return method;
};

const debtStatusBadge = (status) => {
  const map = {
    paid:    'bg-green-100 text-green-800',
    unpaid:  'bg-red-100 text-red-800',
    partial: 'bg-amber-100 text-amber-800',
    overdue: 'bg-red-200 text-red-900 font-black'
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

const debtStatusLabel = (status) => {
  const map = {
    paid:    '✅ Lunas',
    unpaid:  '🔴 Belum Bayar',
    partial: '🟡 Bayar Sebagian',
    overdue: '⚠️ Jatuh Tempo!'
  };
  return map[status] || status;
};

const fmt = (v) => `Rp ${(v || 0).toLocaleString('id-ID')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID') : '-';

const getMlStatusMeta = (status) => {
  const map = {
    approved: {
      label: 'Disetujui',
      tag: '✅ Disetujui',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      isDelivered: false
    },
    partial_rejection: {
      label: 'Pembelian Tidak Lengkap',
      tag: '⚠️ Partial Rejection',
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      isDelivered: false
    },
    in_progress: {
      label: 'Sedang Belanja',
      tag: '🛒 Sedang Belanja',
      badge: 'bg-blue-100 text-blue-800 border-blue-300',
      isDelivered: false
    },
    partially_received: {
      label: 'Diterima Sebagian',
      tag: '📦 Diterima Sebagian',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      isDelivered: true
    },
    received: {
      label: 'Sudah Diterima (Delivered)',
      tag: '🚚 Diterima Gudang (Delivered)',
      badge: 'bg-purple-100 text-purple-800 border-purple-300',
      isDelivered: true
    },
    completed: {
      label: 'Selesai',
      tag: '🏁 Selesai',
      badge: 'bg-slate-100 text-slate-700 border-slate-300',
      isDelivered: true
    }
  };
  return map[status] || {
    label: status || 'Unknown',
    tag: `📋 ${status || 'Unknown'}`,
    badge: 'bg-slate-100 text-slate-600 border-slate-300',
    isDelivered: false
  };
};

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'debts'

  // ---------- Transactions State ----------
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState(null);

  // ---------- Debts State ----------
  const [debts, setDebts] = useState([]);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null); // { purchase: {...} }
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('transfer');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Form state
  const [approvedMLs, setApprovedMLs] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [entryMode, setEntryMode] = useState('marketlist');
  const [selectedMlId, setSelectedMlId] = useState('');
  const [manualProductId, setManualProductId] = useState('');
  const [manualProductSearch, setManualProductSearch] = useState('');
  const [selectedMlDetail, setSelectedMlDetail] = useState(null);
  const [mlFilterTab, setMlFilterTab] = useState('all'); // 'all' | 'active' | 'delivered'
  const [mlSearch, setMlSearch] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentSource, setPaymentSource] = useState('cash'); // cash, bank, petty_cash
  const [dueDate, setDueDate] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [formItems, setFormItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Quick Modal Tambah Supplier Baru
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    phone: '',
    contact_person: '',
    address: ''
  });

  // Edit Transaksi Modal State
  const [editPurchaseModal, setEditPurchaseModal] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    marketlist_id: '',
    supplier_id: '',
    payment_method: 'cash',
    payment_source: 'cash',
    due_date: '',
    amount_paid: '0',
    invoice_ref: '',
    purchased_at: '',
    notes: ''
  });

  // Filters
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Default tempo: 7 hari dari tanggal pembelian
  const getDefaultDueDate = (baseDateStr) => {
    const d = baseDateStr ? new Date(baseDateStr) : new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    if (method === 'transfer') {
      setPaymentSource('bank');
    } else if (method === 'cash' && paymentSource === 'bank') {
      setPaymentSource('cash');
    }
    if (method === 'tempo') {
      setDueDate(getDefaultDueDate(purchaseDate));
    }
  };

  const handlePurchaseDateChange = (val) => {
    setPurchaseDate(val);
    if (paymentMethod === 'tempo') {
      setDueDate(getDefaultDueDate(val));
    }
  };

  // ---------- data loading ----------
  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      let params = '?limit=50';
      if (filterSupplier) params += `&supplier_id=${filterSupplier}`;
      if (filterStartDate) params += `&startDate=${filterStartDate}`;
      if (filterEndDate) params += `&endDate=${filterEndDate}`;
      const res = await api.getPurchases(params);
      setPurchases(res.data || []);
    } catch (e) {
      console.error('Gagal memuat transaksi:', e);
    } finally {
      setLoading(false);
    }
  }, [filterSupplier, filterStartDate, filterEndDate]);

  const fetchDebts = useCallback(async () => {
    setDebtsLoading(true);
    try {
      const res = await api.getDebts('?limit=50');
      setDebts(res.data || []);
    } catch (e) {
      console.error('Gagal memuat hutang:', e);
    } finally {
      setDebtsLoading(false);
    }
  }, []);

  const fetchMasterForForm = async () => {
    try {
      let mlList = [];
      const [mlMultiRes, supRes, productRes] = await Promise.all([
        api.getMarketlists('?status=approved,partial_rejection,in_progress,partially_received,received,completed&limit=100&all=true').catch(() => ({ data: [] })),
        api.getSuppliers().catch(() => ({ data: [] })),
        api.getProducts().catch(() => ({ data: [] }))
      ]);
      mlList = mlMultiRes.data?.items || mlMultiRes.data || [];

      // Fallback: jika respons kosong, fetch status individual untuk menjamin kompatibilitas
      if (mlList.length === 0) {
        const statuses = ['approved', 'partial_rejection', 'in_progress', 'partially_received', 'received', 'completed'];
        const responses = await Promise.all(
          statuses.map((st) => api.getMarketlists(`?status=${st}&limit=50&all=true`).catch(() => ({ data: [] })))
        );
        const map = new Map();
        responses.forEach((res) => {
          const arr = res.data?.items || res.data || [];
          arr.forEach((m) => {
            if (m && m._id && !map.has(m._id)) map.set(m._id, m);
          });
        });
        mlList = Array.from(map.values());
      }

      setApprovedMLs(mlList);
      setSuppliers(supRes.data?.items || supRes.data || []);
      setProducts(productRes.data?.items || productRes.data || []);
    } catch (_) {}
  };

  useEffect(() => {
    fetchPurchases();
    fetchDebts();
    fetchMasterForForm();
  }, [fetchPurchases, fetchDebts]);

  // ---------- handle ML selection & track already purchased & received items ----------
  const handleSelectMarketlist = async (mlId) => {
    setSelectedMlId(mlId);
    setSelectedMlDetail(null);
    if (entryMode !== 'manual') {
      setFormItems([]);
      setSelectedSupplierId('');
    } else {
      setFormItems((currentItems) => currentItems.map((item) => ({
        ...item,
        marketlist_item_id: null,
        marketlist_match: null,
        requested_qty: 0,
        purchased_qty: 0,
        remaining_qty: 0,
        unit_price_ml: 0
      })));
    }
    if (!mlId) return;
    try {
      const [res, purchaseRes, receiptRes] = await Promise.all([
        api.getMarketlistById(mlId),
        api.getPurchases(`?marketlist_id=${mlId}&limit=100`).catch(() => ({ data: [] })),
        api.getReceiptsByMarketlist(mlId).catch(() => ({ data: [] }))
      ]);
      const ml = res.data;
      setSelectedMlDetail(ml);
      if (entryMode === 'manual') {
        setFormItems((currentItems) => currentItems.map((item) => {
          const match = (ml.items || []).find((mlItem) =>
            mlItem.product_id?._id?.toString() === item.product_id?.toString() &&
            mlItem.item_status !== 'rejected'
          );
          return {
            ...item,
            marketlist_item_id: match?._id || null,
            marketlist_match: match || null,
            requested_qty: match?.requested_qty || 0,
            purchased_qty: match?.purchased_qty || 0,
            remaining_qty: Math.max(0, (Number(match?.requested_qty) || 0) - (Number(match?.purchased_qty) || 0)),
            unit_price_ml: match?.unit_price || 0
          };
        }));
        return;
      }

      // Aggregate purchased quantities so partially purchased items remain selectable.
      const alreadyPurchasedMap = {};
      const existingPurchases = purchaseRes.data || [];
      existingPurchases.forEach((p) => {
        (p.items || []).forEach((pItem) => {
          if (pItem.marketlist_item_id) {
            const itemId = pItem.marketlist_item_id.toString();
            const previous = alreadyPurchasedMap[itemId] || { quantity: 0 };
            alreadyPurchasedMap[itemId] = {
              quantity: previous.quantity + (Number(pItem.actual_qty) || 0),
              supplierName: p.supplier_id?.name || 'Supplier Lain',
              purchaseNumber: p.purchase_number
            };
          }
        });
      });

      // Map received quantities from warehouse receiving (Goods Receipt)
      const receivedQtyMap = {};
      const receipts = receiptRes.data || [];
      receipts.forEach((r) => {
        (r.items || []).forEach((rItem) => {
          const mlItemId = rItem.marketlist_item_id?._id?.toString() || rItem.marketlist_item_id?.toString();
          if (mlItemId) {
            const qty = Number(rItem.accepted_qty ?? rItem.received_qty ?? 0);
            receivedQtyMap[mlItemId] = (receivedQtyMap[mlItemId] || 0) + qty;
          }
        });
      });

      const isDeliveredMl = ['received', 'partially_received', 'completed'].includes(ml.status);

      const items = (ml.items || []).map((it) => {
        const p = it.product_id;
        const itemIdStr = it._id.toString();
        const purchase = alreadyPurchasedMap[itemIdStr];
        const purchasedQty = Number(it.purchased_qty ?? purchase?.quantity ?? 0);
        const remainingQty = Math.max(0, (Number(it.requested_qty) || 0) - purchasedQty);
        const already = remainingQty <= 0;
        const receivedQty = receivedQtyMap[itemIdStr] || 0;

        const initialQty = (isDeliveredMl && receivedQty > 0)
          ? Math.min(receivedQty, remainingQty)
          : remainingQty;

        return {
          marketlist_item_id: it._id,
          product_id: p?._id || '',
          supplier_id: it.supplier_id?._id || it.supplier_id || '',
          product_name: p?.name || it.product_name || 'Barang',
          unit_name: p?.unit_id?.abbreviation || p?.unit_id?.name || 'Satuan',
          requested_qty: it.requested_qty || 0,
          purchased_qty: purchasedQty,
          remaining_qty: remainingQty,
          received_qty: receivedQty,
          unit_price_ml: it.unit_price || 0,
          actual_qty: initialQty,
          actual_unit_price: it.unit_price || 0,
          notes: '',
          selected: !already,
          alreadyPurchased: already ? purchase || { quantity: purchasedQty } : null
        };
      });
      setFormItems(items);
    } catch (e) {
      console.error('Gagal load detail ML:', e);
    }
  };

  const handleEntryModeChange = (mode) => {
    setEntryMode(mode);
    setSelectedMlId('');
    setSelectedMlDetail(null);
    setFormItems([]);
    setManualProductId('');
    setManualProductSearch('');
    setSelectedSupplierId('');
  };

  const addManualProduct = () => {
    const product = products.find((entry) => entry._id === manualProductId);
    if (!product) return;
    if (formItems.some((item) => item.product_id?.toString() === product._id.toString())) {
      alert('Barang ini sudah ada di daftar transaksi.');
      return;
    }

    const match = (selectedMlDetail?.items || []).find((item) =>
      item.product_id?._id?.toString() === product._id.toString() &&
      item.item_status !== 'rejected'
    );
    const requestedQty = Number(match?.requested_qty) || 0;
    const purchasedQty = Number(match?.purchased_qty) || 0;
    const remainingQty = Math.max(0, requestedQty - purchasedQty);
    setFormItems((currentItems) => [...currentItems, {
      marketlist_item_id: match?._id || null,
      marketlist_match: match || null,
      product_id: product._id,
      product_name: product.name,
      unit_name: product.unit_id?.abbreviation || product.unit_id?.name || 'Satuan',
      supplier_id: '',
      requested_qty: requestedQty,
      purchased_qty: purchasedQty,
      remaining_qty: remainingQty,
      received_qty: 0,
      unit_price_ml: Number(match?.unit_price) || 0,
      actual_qty: remainingQty || 1,
      actual_unit_price: Number(match?.unit_price || product.last_purchase_price) || 0,
      notes: '',
      selected: true,
      alreadyPurchased: null
    }]);
    setManualProductId('');
  };

  const removeManualProduct = (index) => {
    setFormItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
  };

  // Quick fill helper (Samakan Qty Rencana, Qty Diterima, Harga Rencana)
  const applyQuickFill = (type) => {
    const updated = formItems.map((it) => {
      if (it.alreadyPurchased) return it;
      if (type === 'plan_qty') {
        return { ...it, actual_qty: it.requested_qty };
      }
      if (type === 'received_qty') {
        return { ...it, actual_qty: it.received_qty > 0 ? it.received_qty : it.actual_qty };
      }
      if (type === 'plan_price') {
        return { ...it, actual_unit_price: it.unit_price_ml };
      }
      return it;
    });
    setFormItems(updated);
  };

  // Stepper helper for actual_qty
  const stepQty = (index, delta) => {
    const updated = [...formItems];
    const curr = Number(updated[index].actual_qty) || 0;
    const nextVal = Math.max(0, Math.round((curr + delta) * 100) / 100);
    updated[index].actual_qty = nextVal;
    setFormItems(updated);
  };

  // Toggle item selection for this supplier's transaction
  const toggleItemSelect = (index) => {
    const updated = [...formItems];
    if (updated[index].alreadyPurchased) return;
    updated[index].selected = !updated[index].selected;
    setFormItems(updated);
  };

  // Toggle select all available items
  const toggleSelectAll = (select) => {
    const updated = formItems.map((it) => ({
      ...it,
      selected: it.alreadyPurchased ? false : select
    }));
    setFormItems(updated);
  };

  // Only items checked and not already purchased will be recorded
  const selectedItems = formItems.filter((it) => it.selected && !it.alreadyPurchased);
  const unpurchasedCount = formItems.filter((it) => !it.alreadyPurchased).length;
  const isAllSelected = unpurchasedCount > 0 && selectedItems.length === unpurchasedCount;

  const formTotal = selectedItems.reduce(
    (sum, it) => sum + Number(it.actual_qty || 0) * Number(it.actual_unit_price || 0),
    0
  );

  const handleItemChange = (index, field, value) => {
    const updated = [...formItems];
    updated[index][field] = value;
    setFormItems(updated);
  };

  // ---------- submit purchase (1 transaksi = 1 supplier) ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (entryMode === 'marketlist' && !selectedMlId) { alert('Pilih Marketlist terlebih dahulu.'); return; }
    if (!selectedSupplierId) { alert('Pilih Supplier terlebih dahulu.'); return; }
    if (selectedItems.length === 0) {
      alert('Pilih minimal 1 barang yang dibeli dari supplier ini!');
      return;
    }
    if (paymentMethod === 'tempo' && !dueDate) {
      alert('Untuk pembayaran tempo / hutang, wajib mengisi Tanggal Jatuh Tempo.'); return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...(selectedMlId && { marketlist_id: selectedMlId }),
        supplier_id: selectedSupplierId,
        invoice_ref: invoiceRef.trim(),
        payment_method: paymentMethod,
        payment_source: paymentMethod === 'transfer' ? 'bank' : paymentSource,
        purchased_at: purchaseDate,
        notes: notes.trim(),
        ...(paymentMethod === 'tempo' && {
          due_date: dueDate,
          amount_paid: Number(downPayment) || 0
        }),
        items: selectedItems.map((it) => ({
          ...(it.marketlist_item_id && { marketlist_item_id: it.marketlist_item_id }),
          product_id: it.product_id,
          product_name: it.product_name,
          unit_name: it.unit_name,
          actual_qty: Number(it.actual_qty),
          actual_unit_price: Number(it.actual_unit_price),
          notes: it.notes || ''
        }))
      };

      await api.createPurchase(payload);
      fetchPurchases();
      fetchDebts();

      const selectedSup = suppliers.find((s) => s._id === selectedSupplierId);
      const remainingItems = formItems.filter(
        (it) => !it.alreadyPurchased && !it.selected
      );

      if (entryMode === 'marketlist' && remainingItems.length > 0) {
        if (
          confirm(
            `✅ Transaksi untuk "${selectedSup?.name || 'Supplier'}" berhasil dicatat!\n\n` +
            `Masih ada ${remainingItems.length} barang di Marketlist ini yang belum dicatat transaksinya.\n\n` +
            `Apakah ingin lanjut mencatat transaksi untuk Supplier berikutnya?`
          )
        ) {
          // Keep form open for the same Marketlist, refresh item purchase state
          await handleSelectMarketlist(selectedMlId);
          setSelectedSupplierId('');
          setInvoiceRef('');
          setNotes('');
          setDownPayment('');
          setPaymentMethod('cash');
          setDueDate('');
          setSubmitting(false);
          return;
        }
      } else if (entryMode === 'marketlist') {
        alert(`✅ Transaksi untuk "${selectedSup?.name || 'Supplier'}" berhasil dicatat!\nSemua barang pada Marketlist ini telah selesai ditransaksikan.`);
      } else {
        alert(`✅ Transaksi manual untuk "${selectedSup?.name || 'Supplier'}" berhasil dicatat.`);
      }

      resetForm();
    } catch (e) {
      alert(`Gagal menyimpan transaksi: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick create new supplier
  const handleCreateNewSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierForm.name.trim()) {
      alert('Nama supplier wajib diisi!');
      return;
    }
    setSavingSupplier(true);
    try {
      const res = await api.createSupplier({
        name: newSupplierForm.name.trim(),
        phone: newSupplierForm.phone?.trim() || undefined,
        contact_person: newSupplierForm.contact_person?.trim() || undefined,
        address: newSupplierForm.address?.trim() || undefined
      });
      const created = res.data;
      await fetchMasterForForm();
      setSelectedSupplierId(created._id);
      setShowAddSupplierModal(false);
      setNewSupplierForm({ name: '', phone: '', contact_person: '', address: '' });
      alert(`✅ Supplier "${created.name}" berhasil dibuat & langsung dipilih!`);
    } catch (err) {
      alert(`Gagal membuat supplier: ${err.message}`);
    } finally {
      setSavingSupplier(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEntryMode('marketlist');
    setSelectedMlId('');
    setSelectedMlDetail(null);
    setSelectedSupplierId('');
    setPaymentMethod('cash');
    setPaymentSource('cash');
    setDueDate('');
    setDownPayment('');
    setInvoiceRef('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setFormItems([]);
    setManualProductId('');
    setManualProductSearch('');
  };

  // ---------- view detail ----------
  const handleViewDetail = async (id) => {
    try {
      const res = await api.getPurchaseById(id);
      setDetailPurchase(res.data);
    } catch (e) {
      alert('Gagal memuat detail transaksi.');
    }
  };

  // ---------- debt payment ----------
  const handleOpenPaymentModal = (debt) => {
    setPaymentModal({ purchase: debt });
    setPayAmount(String(debt.amount_remaining || ''));
    setPayMethod('transfer');
    setPayRef('');
    setPayNotes('');
    setPayDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmitPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) {
      alert('Jumlah pembayaran harus lebih dari 0.'); return;
    }
    setSubmittingPayment(true);
    try {
      await api.recordDebtPayment(paymentModal.purchase._id, {
        amount: Number(payAmount),
        payment_method: payMethod,
        paid_at: payDate,
        reference_number: payRef.trim(),
        notes: payNotes.trim()
      });
      alert('✅ Pembayaran hutang berhasil dicatat!');
      setPaymentModal(null);
      fetchDebts();
      fetchPurchases();
    } catch (e) {
      alert(`Gagal mencatat pembayaran: ${e.message}`);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // ---------- edit & delete purchase ----------
  const handleOpenEditModal = (p) => {
    const isTempo = p.payment_method === 'tempo';
    setEditPurchaseModal(p);
    setEditForm({
      marketlist_id: p.marketlist_id?._id || p.marketlist_id || '',
      supplier_id: p.supplier_id?._id || p.supplier_id || '',
      payment_method: p.payment_method || 'cash',
      payment_source: p.payment_source || (p.payment_method === 'transfer' ? 'bank' : 'cash'),
      due_date: p.due_date ? p.due_date.split('T')[0] : getDefaultDueDate(p.purchased_at),
      amount_paid: isTempo ? String(p.amount_paid ?? 0) : '0',
      invoice_ref: p.invoice_ref || '',
      purchased_at: p.purchased_at ? p.purchased_at.split('T')[0] : new Date().toISOString().split('T')[0],
      notes: p.notes || ''
    });
  };

  const handleEditPaymentMethodChange = (method) => {
    setEditForm((prev) => {
      const next = { ...prev, payment_method: method };
      if (method === 'tempo') {
        if (!next.due_date) {
          next.due_date = getDefaultDueDate(next.purchased_at);
        }
        if (prev.payment_method !== 'tempo') {
          next.amount_paid = '0';
        }
      } else {
        next.payment_source = method === 'transfer' ? 'bank' : 'cash';
      }
      return next;
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editPurchaseModal) return;
    if (editForm.payment_method === 'tempo' && !editForm.due_date) {
      alert('Untuk metode tempo / hutang, tanggal jatuh tempo wajib diisi!');
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        marketlist_id: editForm.marketlist_id || null,
        supplier_id: editForm.supplier_id,
        payment_method: editForm.payment_method,
        payment_source: editForm.payment_method === 'transfer' ? 'bank' : (editForm.payment_method === 'tempo' ? editForm.payment_source : 'cash'),
        invoice_ref: editForm.invoice_ref.trim(),
        purchased_at: editForm.purchased_at,
        notes: editForm.notes.trim(),
        ...(editForm.payment_method === 'tempo' && {
          due_date: editForm.due_date,
          amount_paid: Number(editForm.amount_paid) || 0
        })
      };

      await api.updatePurchase(editPurchaseModal._id, payload);
      alert(`✅ Transaksi "${editPurchaseModal.purchase_number}" berhasil diperbarui! Status pembayaran kini menjadi ${editForm.payment_method === 'tempo' ? 'Tempo / Hutang' : 'Lunas'}.`);
      setEditPurchaseModal(null);
      if (detailPurchase && detailPurchase._id === editPurchaseModal._id) {
        handleViewDetail(editPurchaseModal._id);
      }
      fetchPurchases();
      fetchDebts();
    } catch (err) {
      alert(`Gagal memperbarui transaksi: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePurchase = async (p) => {
    if (
      !confirm(
        `⚠️ PERINGATAN: Apakah Anda yakin ingin menghapus transaksi "${p.purchase_number}"?\n\n` +
        `Barang dalam transaksi ini akan dapat dipilih kembali di formulir belanja Marketlist.`
      )
    ) {
      return;
    }

    try {
      await api.deletePurchase(p._id);
      alert(`✅ Transaksi "${p.purchase_number}" berhasil dihapus.`);
      if (detailPurchase && detailPurchase._id === p._id) {
        setDetailPurchase(null);
      }
      fetchPurchases();
      fetchDebts();
      fetchMasterForForm();
    } catch (err) {
      alert(`Gagal menghapus transaksi: ${err.message}`);
    }
  };

  const mlSupplierIds = [...new Set(formItems.map((it) => it.supplier_id).filter(Boolean))];
  const mlSuppliers = suppliers.filter((s) => mlSupplierIds.includes(s._id));

  // Form helpers & filters for Marketlist
  const activeMLCount = approvedMLs.filter((m) => ['approved', 'partial_rejection', 'in_progress'].includes(m.status)).length;
  const deliveredMLCount = approvedMLs.filter((m) => ['partially_received', 'received', 'completed'].includes(m.status)).length;
  const filteredMLs = approvedMLs.filter((m) => {
    if (mlFilterTab === 'active' && !['approved', 'partial_rejection', 'in_progress'].includes(m.status)) return false;
    if (mlFilterTab === 'delivered' && !['partially_received', 'received', 'completed'].includes(m.status)) return false;
    const search = mlSearch.trim().toLowerCase();
    return !search || [m.marketlist_number, m.status, m.location_id?.name,
      ...(m.items || [])
        .filter((item) => item.item_status !== 'rejected')
        .map((item) => item.product_id?.name || item.product_snapshot?.name)]
      .some((value) => String(value || '').toLowerCase().includes(search));
  });
  const visibleManualProducts = products.filter((product) =>
    !manualProductSearch.trim() ||
    product.name.toLowerCase().includes(manualProductSearch.trim().toLowerCase()) ||
    product.sku?.toLowerCase().includes(manualProductSearch.trim().toLowerCase())
  );
  const hasAnyReceived = formItems.some((it) => (it.received_qty || 0) > 0);
  const isDeliveredSelectedMl = selectedMlDetail && ['partially_received', 'received', 'completed'].includes(selectedMlDetail.status);

  // Debt summary
  const totalDebt = debts.reduce((s, d) => s + (d.amount_remaining || 0), 0);
  const overdueCount = debts.filter((d) => d.payment_status === 'overdue').length;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Transaksi Pembelian & Hutang Supplier" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Info Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
          <ShoppingCart className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Pencatatan Transaksi Pembelian & Manajemen Hutang Supplier</p>
            <p className="text-amber-800/80 mt-0.5">
              Catat pembelian berdasarkan Marketlist. Pembelian dengan <strong>Tempo / Hutang</strong> dapat dibayar bertahap dan dilacak hingga lunas.
            </p>
          </div>
        </div>

        {/* Debt Summary Cards */}
        {debts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-semibold uppercase">Total Hutang Aktif</p>
                <p className="text-lg font-black text-red-700">{fmt(totalDebt)}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-semibold uppercase">Tagihan Belum Lunas</p>
                <p className="text-lg font-black text-amber-700">{debts.length} Transaksi</p>
              </div>
            </div>
            <div className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${overdueCount > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
              <div className={`p-2.5 rounded-lg ${overdueCount > 0 ? 'bg-red-200' : 'bg-green-100'}`}>
                <AlertOctagon className={`w-5 h-5 ${overdueCount > 0 ? 'text-red-700' : 'text-green-600'}`} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-semibold uppercase">Jatuh Tempo</p>
                <p className={`text-lg font-black ${overdueCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {overdueCount > 0 ? `⚠️ ${overdueCount} Tagihan Overdue` : '✅ Semua On-Track'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'transactions'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Riwayat Transaksi
          </button>
          <button
            onClick={() => setActiveTab('debts')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'debts'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Hutang & Tempo
            {debts.length > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {debts.length}
              </span>
            )}
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <button
            onClick={() => { fetchMasterForForm(); setShowForm(true); }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Catat Transaksi Baru
          </button>

          {activeTab === 'transactions' && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="text-xs p-2 bg-white border border-slate-200 rounded-lg"
              >
                <option value="">Semua Supplier</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="text-xs p-2 bg-white border border-slate-200 rounded-lg"
              />
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="text-xs p-2 bg-white border border-slate-200 rounded-lg"
              />
            </div>
          )}
        </div>

        {/* ===== FORM MODAL ===== */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                  Formulir Pencatatan Transaksi Pembelian
                </h3>
                <button onClick={resetForm} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Cara input transaksi</p>
                    <p className="text-[10px] text-slate-500">Pilih Marketlist atau catat nota manual dengan alokasi Marketlist opsional.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEntryModeChange('marketlist')}
                      className={`rounded-lg px-3 py-2 text-xs font-bold ${entryMode === 'marketlist' ? 'bg-amber-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                    >
                      Dari Marketlist
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEntryModeChange('manual')}
                      className={`rounded-lg px-3 py-2 text-xs font-bold ${entryMode === 'manual' ? 'bg-amber-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                    >
                      Input Manual
                    </button>
                  </div>
                </div>
                {/* Marketlist selection */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-slate-700">
                      <ClipboardList className="w-3.5 h-3.5 inline mr-1 text-amber-600" />
                      {entryMode === 'manual' ? 'Alokasikan ke Marketlist (Opsional)' : 'Pilih Marketlist (Disetujui / Delivered)'}
                    </label>
                    {/* Quick filter tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
                      <button
                        type="button"
                        onClick={() => setMlFilterTab('all')}
                        className={`px-2 py-0.5 rounded font-bold transition ${
                          mlFilterTab === 'all'
                            ? 'bg-white text-slate-800 shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Semua ({approvedMLs.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMlFilterTab('active')}
                        className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                          mlFilterTab === 'active'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <span>🛒 Belanja Aktif</span>
                        <span className="opacity-80">({activeMLCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMlFilterTab('delivered')}
                        className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                          mlFilterTab === 'delivered'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <span>🚚 Delivered</span>
                        <span className="opacity-80">({deliveredMLCount})</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="search"
                    value={mlSearch}
                    onChange={(e) => setMlSearch(e.target.value)}
                    placeholder="Cari nomor Marketlist, nama produk, gudang, atau status..."
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <select
                    value={selectedMlId}
                    onChange={(e) => handleSelectMarketlist(e.target.value)}
                    required={entryMode === 'marketlist'}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
                  >
                    <option value="">{entryMode === 'manual' ? '-- Tidak dialokasikan ke Marketlist --' : '-- Pilih Marketlist untuk Transaksi Belanja --'}</option>
                    {filteredMLs.map((ml) => {
                      const meta = getMlStatusMeta(ml.status);
                      const reqDateStr = new Date(ml.required_date || ml.date).toLocaleDateString('id-ID');
                      const estStr = fmt(ml.estimated_total || ml.totals?.estimated_amount);
                      const productMatches = (ml.items || [])
                        .filter((item) => item.item_status !== 'rejected')
                        .map((item) => item.product_id?.name || item.product_snapshot?.name)
                        .filter((name) => name && (
                          !mlSearch.trim() || name.toLowerCase().includes(mlSearch.trim().toLowerCase())
                        ));
                      const remainingItems = (ml.items || []).filter(
                        (item) => item.item_status !== 'rejected' &&
                          (Number(item.requested_qty) || 0) > (Number(item.purchased_qty) || 0)
                      ).length;
                      return (
                        <option key={ml._id} value={ml._id}>
                          {meta.tag} | {ml.code || ml.marketlist_number} •
                          {mlSearch.trim() && productMatches.length ? ` Produk: ${productMatches.join(', ')} •` : ''} Sisa {remainingItems} barang • Tgl: {reqDateStr} • Est: {estStr}
                        </option>
                      );
                    })}
                  </select>

                  {/* Status Banner when an ML is selected */}
                  {selectedMlDetail && entryMode === 'marketlist' && (
                    <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      isDeliveredSelectedMl
                        ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                        : 'bg-blue-50/70 border-blue-200 text-blue-950'
                    }`}>
                      {isDeliveredSelectedMl ? (
                        <Truck className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <ShoppingCart className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">
                            {selectedMlDetail.code || selectedMlDetail.marketlist_number}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getMlStatusMeta(selectedMlDetail.status).badge}`}>
                            {getMlStatusMeta(selectedMlDetail.status).tag}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] opacity-90">
                          {isDeliveredSelectedMl ? (
                            <>
                              Barang pada Marketlist ini sudah diterima di gudang (Delivered). Anda dapat mencatat nota belanja fisik yang baru diserahkan oleh supplier. Kuantitas barang otomatis dapat diselaraskan dengan penerimaan fisik gudang.
                            </>
                          ) : (
                            <>
                              Marketlist dalam tahap belanja / disetujui. Pilih supplier dan pilih barang yang dibeli untuk transaksi ini.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {(selectedMlDetail || entryMode === 'manual') && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-amber-600" />
                            <span>Supplier Tujuan *</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowAddSupplierModal(true)}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 transition"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Supplier Baru</span>
                          </button>
                        </div>
                        <select
                          value={selectedSupplierId}
                          onChange={(e) => setSelectedSupplierId(e.target.value)}
                          required
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800"
                        >
                          <option value="">-- Pilih Supplier --</option>
                          {suppliers.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name} {s.contact_person ? `(${s.contact_person})` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                          1 Transaksi untuk 1 Supplier. Pilih barang yang dibeli di supplier ini di bawah.
                        </p>
                      </div>

                      {entryMode === 'manual' && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                          <label className="mb-2 block text-xs font-bold text-slate-700">
                            Tambah barang dari master item
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              type="search"
                              value={manualProductSearch}
                              onChange={(event) => {
                                setManualProductSearch(event.target.value);
                                setManualProductId('');
                              }}
                              placeholder="Ketik nama produk atau SKU..."
                              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                            />
                            <select
                              value={manualProductId}
                              onChange={(event) => setManualProductId(event.target.value)}
                              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                            >
                              <option value="">-- Pilih barang --</option>
                              {visibleManualProducts.map((product) => {
                                const match = (selectedMlDetail?.items || []).find((item) =>
                                  item.product_id?._id?.toString() === product._id.toString() &&
                                  item.item_status !== 'rejected'
                                );
                                const remaining = Math.max(
                                  0,
                                  (Number(match?.requested_qty) || 0) - (Number(match?.purchased_qty) || 0)
                                );
                                return (
                                  <option key={product._id} value={product._id}>
                                    {product.name} ({product.unit_id?.abbreviation || product.unit_id?.name || 'Satuan'})
                                    {match ? ` • Cocok di ML, sisa ${remaining}` : ''}
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              type="button"
                              onClick={addManualProduct}
                              disabled={!manualProductId}
                              className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                              <Plus className="h-4 w-4" /> Tambah Barang
                            </button>
                          </div>
                          {mlSearch.trim() && filteredMLs.length > 0 && (
                            <p className="mt-2 text-[10px] text-blue-800">
                              Ditemukan di {filteredMLs.filter((ml) =>
                                (ml.items || []).some((item) =>
                                item.item_status !== 'rejected' &&
                                (item.product_id?.name || item.product_snapshot?.name || '')
                                    .toLowerCase().includes(mlSearch.trim().toLowerCase())
                                )
                              ).length} Marketlist. Pilih Marketlist untuk memuat rincian barang.
                            </p>
                          )}
                          {selectedMlDetail && (
                            <p className="mt-2 text-[10px] text-emerald-800">
                              Barang yang ada di {selectedMlDetail.marketlist_number} akan ditandai dan otomatis dialokasikan ke item Marketlist yang cocok.
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                          Metode Pembayaran
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => handlePaymentMethodChange(e.target.value)}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                        >
                          {PAYMENT_METHODS.map((pm) => (
                            <option key={pm.value} value={pm.value}>{pm.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          <Calendar className="w-3.5 h-3.5 inline mr-1" />
                          Tanggal Pembelian
                        </label>
                        <input
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => handlePurchaseDateChange(e.target.value)}
                          required
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    {/* Tempo/Hutang fields (Default 7 Hari) */}
                    {paymentMethod === 'tempo' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Pengaturan Hutang / Tempo
                          </p>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            Default Tempo: 7 Hari
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">
                              Tanggal Jatuh Tempo <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              required={paymentMethod === 'tempo'}
                              min={purchaseDate}
                              className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-amber-900"
                            />
                            <p className="text-[10px] text-amber-700 mt-0.5">
                              * Otomatis 7 hari dari tanggal belanja (dapat diubah sesuai kesepakatan)
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">
                              Uang Muka / DP (Opsional)
                            </label>
                            <input
                              type="number"
                              value={downPayment}
                              onChange={(e) => setDownPayment(e.target.value)}
                              placeholder="0 = hutang penuh"
                              min="0"
                              className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <p className="text-[10px] text-amber-700 mt-0.5">
                              Sisa hutang = Total - DP = {fmt(formTotal - (Number(downPayment) || 0))}
                            </p>
                          </div>
                          {(paymentMethod === 'cash' || Number(downPayment) > 0) && (
                            <div className="sm:col-span-2 pt-2 border-t border-amber-200">
                              <label className="block text-xs font-bold text-amber-900 mb-1">
                                {paymentMethod === 'tempo' ? 'Sumber Dana Uang Muka (DP)' : 'Sumber Dana Pembelian'} *
                              </label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                                  <input
                                    type="radio"
                                    name="paymentSource"
                                    value="cash"
                                    checked={paymentSource === 'cash'}
                                    onChange={(e) => setPaymentSource(e.target.value)}
                                  />
                                  <span>💵 Kas Tunai (Uang Cash)</span>
                                </label>
                                {paymentMethod === 'tempo' && <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                                  <input
                                    type="radio"
                                    name="paymentSource"
                                    value="bank"
                                    checked={paymentSource === 'bank'}
                                    onChange={(e) => setPaymentSource(e.target.value)}
                                  />
                                  <span>🏦 Transfer Bank (Rekening)</span>
                                </label>}
                                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                                  <input
                                    type="radio"
                                    name="paymentSource"
                                    value="petty_cash"
                                    checked={paymentSource === 'petty_cash'}
                                    onChange={(e) => setPaymentSource(e.target.value)}
                                  />
                                  <span>🪙 Kas Kecil</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          <FileText className="w-3.5 h-3.5 inline mr-1" />
                          No. Nota / Referensi Invoice Supplier
                        </label>
                        <input
                          type="text"
                          value={invoiceRef}
                          onChange={(e) => setInvoiceRef(e.target.value)}
                          placeholder="Contoh: NOTA-2026-11-001"
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Catatan Transaksi</label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Catatan opsional..."
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    {/* Items Table with Checkboxes */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-amber-600" />
                          <h4 className="text-xs font-bold text-slate-800">
                            Pilih Barang yang Dibeli dari Supplier Ini:
                          </h4>
                          <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                            {selectedItems.length} dari {formItems.length} barang dipilih
                          </span>
                        </div>

                        {/* Quick Batch Actions */}
                        {entryMode === 'marketlist' && unpurchasedCount > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={() => toggleSelectAll(!isAllSelected)}
                              className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded transition"
                            >
                              {isAllSelected ? 'Batalkan Pilih Semua' : '✓ Pilih Semua Sisa'}
                            </button>

                            <button
                              type="button"
                              onClick={() => applyQuickFill('plan_qty')}
                              title="Set kuantitas aktual sama dengan kuantitas rencana ML"
                              className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2 py-1 rounded transition flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>⚡ Samakan Qty Rencana</span>
                            </button>

                            {hasAnyReceived && (
                              <button
                                type="button"
                                onClick={() => applyQuickFill('received_qty')}
                                title="Set kuantitas aktual sama dengan kuantitas yang diterima gudang"
                                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-1 rounded transition flex items-center gap-1"
                              >
                                <Truck className="w-3 h-3 text-purple-600" />
                                <span>🚚 Samakan Qty Diterima Gudang</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => applyQuickFill('plan_price')}
                              title="Set harga aktual sama dengan estimasi harga ML"
                              className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2 py-1 rounded transition"
                            >
                              💰 Samakan Harga ML
                            </button>
                          </div>
                        )}
                      </div>

                      {formItems.length === 0 ? (
                        <div className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-lg">
                          <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-slate-300" />
                          {entryMode === 'manual' ? 'Pilih barang dari master item untuk memulai transaksi.' : 'Pilih Marketlist terlebih dahulu.'}
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2.5 text-center w-10">Pilih</th>
                                <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Nama Barang</th>
                                <th className="px-3 py-2.5 text-center text-slate-500 font-semibold">Req ML</th>
                                <th className="px-3 py-2.5 text-center text-slate-500 font-semibold">Sudah Dibeli</th>
                                <th className="px-3 py-2.5 text-center text-slate-500 font-semibold">Diterima Gudang</th>
                                <th className="px-3 py-2.5 text-center text-slate-500 font-semibold">Harga ML</th>
                                <th className="px-3 py-2.5 text-center text-amber-600 font-bold min-w-[140px]">Qty Beli Aktual</th>
                                <th className="px-3 py-2.5 text-center text-amber-600 font-bold min-w-[130px]">Harga Beli Satuan</th>
                                <th className="px-3 py-2.5 text-right text-slate-500 font-semibold">Subtotal</th>
                                <th className="px-3 py-2.5 text-center text-slate-500 font-semibold">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {formItems.map((it, idx) => {
                                const isBought = !!it.alreadyPurchased;
                                const isChecked = !isBought && it.selected;
                                const sub = Number(it.actual_qty || 0) * Number(it.actual_unit_price || 0);

                                return (
                                  <tr
                                    key={it.marketlist_item_id || idx}
                                    className={`transition-colors ${
                                      isBought
                                        ? 'bg-slate-100/70 opacity-60'
                                        : entryMode === 'manual' && it.marketlist_item_id
                                        ? 'bg-emerald-50 hover:bg-emerald-100/70'
                                        : isChecked
                                        ? 'bg-amber-50/40 hover:bg-amber-50/70'
                                        : 'hover:bg-slate-50/50'
                                    }`}
                                  >
                                    <td className="px-3 py-2.5 text-center">
                                      {isBought ? (
                                        <span title="Sudah ditransaksikan" className="text-emerald-600 font-bold text-xs">
                                          ✓
                                        </span>
                                      ) : (
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleItemSelect(idx)}
                                          className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                        />
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <div className="font-semibold text-slate-800">
                                        {it.product_name}
                                        <span className="ml-1 text-slate-400 font-normal">({it.unit_name})</span>
                                      </div>
                                      {entryMode === 'manual' && (
                                        <span className={`mt-0.5 inline-block text-[10px] font-semibold ${it.marketlist_item_id ? 'text-emerald-700' : 'text-slate-400'}`}>
                                          {it.marketlist_item_id
                                            ? `✓ Cocok dengan item ${selectedMlDetail?.marketlist_number} — akan dialokasikan`
                                            : selectedMlDetail ? 'Tidak ada item cocok di Marketlist ini' : 'Transaksi manual'}
                                        </span>
                                      )}
                                      {isBought && (
                                        <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                                          ✓ Sudah Dibeli di {it.alreadyPurchased.supplierName} ({it.alreadyPurchased.purchaseNumber})
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-slate-500 font-medium">
                                      {it.requested_qty} {it.unit_name}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-slate-600">
                                      {it.purchased_qty > 0 ? `${it.purchased_qty} / ${it.requested_qty}` : '-'}
                                      {it.remaining_qty > 0 && (
                                        <span className="block text-[10px] text-amber-700">
                                          Sisa {it.remaining_qty} {it.unit_name}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      {it.received_qty > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                                          <Truck className="w-3 h-3" />
                                          {it.received_qty} {it.unit_name}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-slate-500">{fmt(it.unit_price_ml)}</td>
                                    <td className="px-3 py-2.5 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          disabled={isBought || !isChecked || Number(it.actual_qty) <= 0}
                                          onClick={() => stepQty(idx, -1)}
                                          className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40 transition"
                                        >
                                          -
                                        </button>
                                        <input
                                          type="number"
                                          disabled={isBought || !isChecked}
                                          value={it.actual_qty}
                                          onChange={(e) => handleItemChange(idx, 'actual_qty', e.target.value)}
                                          min="0"
                                          step="any"
                                          className="w-16 text-xs text-center p-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                        <button
                                          type="button"
                                          disabled={isBought || !isChecked}
                                          onClick={() => stepQty(idx, 1)}
                                          className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40 transition"
                                        >
                                          +
                                        </button>
                                      </div>
                                      {/* Quick helpers per row */}
                                      <div className="flex items-center justify-center gap-1 mt-1">
                                        {it.received_qty > 0 && Number(it.actual_qty) !== Number(it.received_qty) && (
                                          <button
                                            type="button"
                                            onClick={() => handleItemChange(idx, 'actual_qty', it.received_qty)}
                                            className="text-[9px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-1 py-0.5 rounded border border-purple-200"
                                            title="Gunakan Qty Diterima Gudang"
                                          >
                                            🚚 {it.received_qty}
                                          </button>
                                        )}
                                        {it.requested_qty > 0 && Number(it.actual_qty) !== Number(it.requested_qty) && (
                                          <button
                                            type="button"
                                            onClick={() => handleItemChange(idx, 'actual_qty', it.requested_qty)}
                                            className="text-[9px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-1 py-0.5 rounded border border-slate-200"
                                            title="Gunakan Qty Rencana ML"
                                          >
                                            ⚡ {it.requested_qty}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <input
                                          type="number"
                                          disabled={isBought || !isChecked}
                                          value={it.actual_unit_price}
                                          onChange={(e) => handleItemChange(idx, 'actual_unit_price', e.target.value)}
                                          min="0"
                                          step="any"
                                          className="w-24 text-xs text-center p-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                        {Number(it.actual_unit_price) !== Number(it.unit_price_ml) && (
                                          <button
                                            type="button"
                                            disabled={isBought || !isChecked}
                                            onClick={() => handleItemChange(idx, 'actual_unit_price', it.unit_price_ml)}
                                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                                            title={`Reset ke harga ML: ${fmt(it.unit_price_ml)}`}
                                          >
                                            <RotateCcw className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                                      {isChecked ? fmt(sub) : '-'}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      {entryMode === 'manual' && (
                                        <button
                                          type="button"
                                          onClick={() => removeManualProduct(idx)}
                                          className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                                          title="Hapus barang"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="border-t-2 border-slate-300 bg-amber-50/50">
                              <tr>
                                <td colSpan="9" className="px-3 py-3 text-right font-black text-slate-700 text-sm">
                                  TOTAL TRANSAKSI SUPPLIER INI ({selectedItems.length} BARANG):
                                </td>
                                <td className="px-3 py-3 text-right font-black text-amber-700 text-sm">{fmt(formTotal)}</td>
                              </tr>
                              {paymentMethod === 'tempo' && (
                                <>
                                  <tr className="text-xs">
                                    <td colSpan="9" className="px-3 py-1 text-right text-slate-500">Uang Muka / DP:</td>
                                    <td className="px-3 py-1 text-right text-green-700 font-bold">{fmt(Number(downPayment) || 0)}</td>
                                  </tr>
                                  <tr className="text-xs">
                                    <td colSpan="9" className="px-3 py-1 text-right text-red-700 font-bold">Sisa Hutang:</td>
                                    <td className="px-3 py-1 text-right text-red-700 font-black">{fmt(formTotal - (Number(downPayment) || 0))}</td>
                                  </tr>
                                </>
                              )}
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || selectedItems.length === 0}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-2 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {submitting ? 'Menyimpan...' : `Simpan Transaksi (${selectedItems.length} Barang)`}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL TAMBAH SUPPLIER BARU ===== */}
        {showAddSupplierModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-600" />
                  Tambah Supplier Baru
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateNewSupplier} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Supplier / Toko *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Toko Sayur Segar Pak Budi"
                    value={newSupplierForm.name}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 081234567890"
                    value={newSupplierForm.phone}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kontak Person / Nama Penjual
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Pak Budi"
                    value={newSupplierForm.contact_person}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, contact_person: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Alamat Toko / Lapak Pasar
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Pasar Induk Kramat Jati Blok A No. 12"
                    value={newSupplierForm.address}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, address: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSupplierModal(false)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingSupplier}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    {savingSupplier ? 'Menyimpan...' : 'Simpan & Pilih Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== DETAIL MODAL ===== */}
        {detailPurchase && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  Detail Transaksi: {detailPurchase.purchase_number}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(detailPurchase)}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Pencil className="w-3.5 h-3.5 text-amber-600" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeletePurchase(detailPurchase)}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>Hapus</span>
                  </button>
                  <button onClick={() => setDetailPurchase(null)} className="p-1 hover:bg-slate-100 rounded-lg ml-1">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Marketlist', value: detailPurchase.marketlist_id?.code || detailPurchase.marketlist_id?.marketlist_number || '-' },
                    { label: 'Supplier', value: detailPurchase.supplier_id?.name || '-' },
                    { label: 'Metode & Akun Bayar', value: paymentLabel(detailPurchase.payment_method, detailPurchase.payment_source) },
                    { label: 'Tanggal Beli', value: fmtDate(detailPurchase.purchased_at) }
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">{m.label}</p>
                      <p className="text-xs font-bold text-slate-800 mt-1">{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Debt Status for Tempo */}
                {detailPurchase.payment_method === 'tempo' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      Status Hutang / Tempo
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500">Total Tagihan</p>
                        <p className="font-black text-slate-800">{fmt(detailPurchase.total_actual)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Sudah Dibayar</p>
                        <p className="font-black text-green-700">{fmt(detailPurchase.amount_paid)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Sisa Hutang</p>
                        <p className="font-black text-red-700">{fmt(detailPurchase.amount_remaining)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${debtStatusBadge(detailPurchase.payment_status)}`}>
                        {debtStatusLabel(detailPurchase.payment_status)}
                      </span>
                      {detailPurchase.due_date && (
                        <span className="text-[10px] text-slate-500">
                          Jatuh Tempo: {fmtDate(detailPurchase.due_date)}
                        </span>
                      )}
                    </div>

                    {/* Debt payment history */}
                    {(detailPurchase.debt_payments || []).length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-bold text-slate-600 uppercase mb-1.5">Riwayat Pembayaran:</p>
                        <div className="space-y-1">
                          {detailPurchase.debt_payments.map((dp, i) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100 text-xs">
                              <span className="text-slate-600">{fmtDate(dp.paid_at)} — {dp.payment_method === 'cash' ? 'Tunai' : 'Transfer'}</span>
                              <span className="font-black text-green-700">{fmt(dp.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detailPurchase.invoice_ref && <p className="text-xs text-slate-600"><span className="font-bold">No. Nota:</span> {detailPurchase.invoice_ref}</p>}
                {detailPurchase.notes && <p className="text-xs text-slate-600"><span className="font-bold">Catatan:</span> {detailPurchase.notes}</p>}

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-slate-500 font-semibold">Nama Barang</th>
                        <th className="px-4 py-2.5 text-center">Qty</th>
                        <th className="px-4 py-2.5 text-center">Harga Satuan</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detailPurchase.items || []).map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {it.product_name || it.product_id?.name || 'Barang'}
                            <span className="ml-1 text-slate-400 font-normal">({it.unit_name || 'Satuan'})</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">{it.actual_qty}</td>
                          <td className="px-4 py-2.5 text-center">{fmt(it.actual_unit_price)}</td>
                          <td className="px-4 py-2.5 text-right font-bold">{fmt(it.actual_subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-300 bg-amber-50/50">
                      <tr>
                        <td colSpan="3" className="px-4 py-3 text-right font-black text-slate-700 text-sm">TOTAL:</td>
                        <td className="px-4 py-3 text-right font-black text-amber-700 text-sm">{fmt(detailPurchase.total_actual)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Dicatat oleh: {detailPurchase.purchased_by?.name || '-'} • {new Date(detailPurchase.createdAt).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== PAYMENT MODAL ===== */}
        {paymentModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-600" />
                  Bayar Hutang — {paymentModal.purchase.purchase_number}
                </h3>
                <button onClick={() => setPaymentModal(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-600">Supplier:</span>
                    <span className="text-slate-900">{paymentModal.purchase.supplier_id?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-600">Total Tagihan:</span>
                    <span className="font-black text-slate-900">{fmt(paymentModal.purchase.total_actual)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-600">Sudah Dibayar:</span>
                    <span className="font-bold text-green-700">{fmt(paymentModal.purchase.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between mt-1 border-t border-red-200 pt-1">
                    <span className="text-red-700 font-black">Sisa Hutang:</span>
                    <span className="text-red-700 font-black">{fmt(paymentModal.purchase.amount_remaining)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jumlah Pembayaran (Rp) *</label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    max={paymentModal.purchase.amount_remaining}
                    min="1"
                    className="w-full text-sm p-2.5 border-2 border-green-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Metode Pembayaran</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="transfer">Transfer Bank</option>
                      <option value="cash">Tunai / Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Bayar</label>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">No. Referensi Transfer (Opsional)</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="Contoh: TRF-20261106-001"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Catatan (Opsional)</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setPaymentModal(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSubmitPayment}
                    disabled={submittingPayment}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submittingPayment ? 'Menyimpan...' : 'Catat Pembayaran'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== EDIT MODAL ===== */}
        {editPurchaseModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-8">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-amber-50/50 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-amber-600" />
                    Edit Transaksi Belanja
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono font-semibold">
                    {editPurchaseModal.purchase_number} • Total: {fmt(editPurchaseModal.total_actual)}
                  </p>
                </div>
                <button
                  onClick={() => setEditPurchaseModal(null)}
                  className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
                {/* Info alert */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2.5">
                  <CreditCard className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <p className="font-bold">Alokasi Marketlist & Pembayaran</p>
                    <p className="opacity-90 mt-0.5">
                      Pilih Marketlist untuk mengalokasikan transaksi ini belakangan. Barang yang cocok akan ditautkan otomatis; barang tanpa pasangan tetap masuk invoice sebagai item manual. Metode Tempo tetap mengatur pencatatan hutang dan tanggal jatuh tempo.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alokasikan ke Marketlist (opsional)</label>
                  <select
                    value={editForm.marketlist_id}
                    onChange={(e) => setEditForm({ ...editForm, marketlist_id: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800"
                  >
                    <option value="">Tanpa Marketlist</option>
                    {approvedMLs
                      .filter((ml) =>
                        ['approved', 'partial_rejection', 'in_progress', 'partially_received', 'received'].includes(ml.status) ||
                        ml._id === editForm.marketlist_id
                      )
                      .map((ml) => (
                        <option key={ml._id} value={ml._id}>
                          {ml.marketlist_number} [{ml.status?.replace(/_/g, ' ')}]
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Supplier</label>
                    <select
                      value={editForm.supplier_id}
                      onChange={(e) => setEditForm({ ...editForm, supplier_id: e.target.value })}
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800"
                    >
                      <option value="">-- Pilih Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tanggal Pembelian</label>
                    <input
                      type="date"
                      value={editForm.purchased_at}
                      onChange={(e) => setEditForm({ ...editForm, purchased_at: e.target.value })}
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Metode Pembayaran */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Metode Pembayaran *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((pm) => {
                      const isSel = editForm.payment_method === pm.value;
                      return (
                        <button
                          key={pm.value}
                          type="button"
                          onClick={() => handleEditPaymentMethodChange(pm.value)}
                          className={`p-2.5 rounded-xl border text-center transition font-bold ${
                            isSel
                              ? pm.value === 'tempo'
                                ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-xs'
                                : 'bg-slate-900 border-slate-900 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {pm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tempo / Hutang Configuration */}
                {editForm.payment_method === 'tempo' && (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-amber-950 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Pengaturan Hutang / Tempo
                      </p>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                        Default: 7 Hari
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Tanggal Jatuh Tempo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.due_date}
                          onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                          required={editForm.payment_method === 'tempo'}
                          min={editForm.purchased_at}
                          className="w-full p-2.5 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-amber-950"
                        />
                        <p className="text-[10px] text-amber-800 mt-1">
                          Batas akhir pembayaran hutang ke supplier
                        </p>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Uang Muka / Sudah Dibayar (DP)
                        </label>
                        <input
                          type="number"
                          value={editForm.amount_paid}
                          onChange={(e) => setEditForm({ ...editForm, amount_paid: e.target.value })}
                          min="0"
                          max={editPurchaseModal.total_actual}
                          placeholder="0 = Belum bayar sama sekali"
                          className="w-full p-2.5 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-900"
                        />
                        <p className="text-[10px] text-amber-800 mt-1">
                          Isi 0 jika belum ada pembayaran sama sekali
                        </p>
                      </div>
                      {Number(editForm.amount_paid) > 0 && (
                        <div className="sm:col-span-2 pt-2 border-t border-amber-200">
                          <label className="block text-xs font-bold text-amber-900 mb-1">
                            Sumber Dana Uang Muka (DP) *
                          </label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                              <input
                                type="radio"
                                name="editPaymentSource"
                                value="cash"
                                checked={editForm.payment_source === 'cash'}
                                onChange={(e) => setEditForm({ ...editForm, payment_source: e.target.value })}
                              />
                              <span>💵 Kas Tunai (Uang Cash)</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                              <input
                                type="radio"
                                name="editPaymentSource"
                                value="bank"
                                checked={editForm.payment_source === 'bank'}
                                onChange={(e) => setEditForm({ ...editForm, payment_source: e.target.value })}
                              />
                              <span>🏦 Transfer Bank (Rekening)</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                              <input
                                type="radio"
                                name="editPaymentSource"
                                value="petty_cash"
                                checked={editForm.payment_source === 'petty_cash'}
                                onChange={(e) => setEditForm({ ...editForm, payment_source: e.target.value })}
                              />
                              <span>🪙 Kas Kecil</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-white/80 border border-amber-200 p-2.5 rounded-lg flex items-center justify-between text-xs">
                      <span className="text-slate-600">Total Transaksi: <strong className="text-slate-900">{fmt(editPurchaseModal.total_actual)}</strong></span>
                      <span className="text-red-700 font-black">
                        Sisa Hutang: {fmt(Math.max(0, editPurchaseModal.total_actual - (Number(editForm.amount_paid) || 0)))}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      No. Nota / Invoice Supplier
                    </label>
                    <input
                      type="text"
                      value={editForm.invoice_ref}
                      onChange={(e) => setEditForm({ ...editForm, invoice_ref: e.target.value })}
                      placeholder="Contoh: NOTA-12345"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Catatan</label>
                    <input
                      type="text"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Catatan tambahan..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditPurchaseModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== TAB CONTENT ===== */}
        {activeTab === 'transactions' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">Riwayat Transaksi Pembelian</h3>
              <span className="text-xs text-slate-400">{purchases.length} Transaksi</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">No. Transaksi</th>
                    <th className="px-5 py-3.5">Marketlist</th>
                    <th className="px-5 py-3.5">Supplier</th>
                    <th className="px-5 py-3.5">Tanggal</th>
                    <th className="px-5 py-3.5">Metode</th>
                    <th className="px-5 py-3.5">Status Bayar</th>
                    <th className="px-5 py-3.5">Total Aktual</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                        {loading ? 'Memuat...' : 'Belum ada transaksi pembelian yang dicatat.'}
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p._id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">{p.purchase_number}</td>
                        <td className="px-5 py-3.5 text-amber-700 font-semibold">{p.marketlist_id?.code || p.marketlist_id?.marketlist_number || 'Manual'}</td>
                        <td className="px-5 py-3.5 text-slate-700">{p.supplier_id?.name || '-'}</td>
                        <td className="px-5 py-3.5 text-slate-500">{fmtDate(p.purchased_at)}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${paymentBadge(p.payment_method)}`}>
                            {paymentLabel(p.payment_method, p.payment_source)}
                          </span>
                          {p.payment_method === 'tempo' && p.amount_paid > 0 && (
                            <p className="text-[9px] text-slate-500 mt-0.5">
                              DP via {p.payment_source === 'bank' ? '🏦 Rekening Bank' : p.payment_source === 'petty_cash' ? '🪙 Kas Kecil' : '💵 Kas Tunai'}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {p.payment_method === 'tempo' ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${debtStatusBadge(p.payment_status)}`}>
                              {debtStatusLabel(p.payment_status)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-[10px] font-bold">✅ Lunas</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-black text-slate-900">{fmt(p.total_actual)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleViewDetail(p._id)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                              title="Lihat Detail Transaksi"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-600" />
                              Detail
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                              title="Edit Transaksi (Ubah Metode/Hutang/Tanggal)"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-600" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePurchase(p)}
                              className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold inline-flex items-center transition"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ===== DEBTS TAB ===== */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-red-600" />
                Daftar Hutang & Tempo Aktif
              </h3>
              <span className="text-xs text-slate-400">{debts.length} Tagihan • Total {fmt(totalDebt)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">No. Transaksi</th>
                    <th className="px-5 py-3.5">Supplier</th>
                    <th className="px-5 py-3.5">Tanggal Beli</th>
                    <th className="px-5 py-3.5">Jatuh Tempo</th>
                    <th className="px-5 py-3.5">Total Tagihan</th>
                    <th className="px-5 py-3.5">Sudah Bayar</th>
                    <th className="px-5 py-3.5">Sisa Hutang</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {debts.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center text-slate-400">
                        {debtsLoading ? 'Memuat...' : '✅ Tidak ada hutang aktif. Semua tagihan sudah lunas!'}
                      </td>
                    </tr>
                  ) : (
                    debts.map((d) => (
                      <tr key={d._id} className={`hover:bg-slate-50 ${d.payment_status === 'overdue' ? 'bg-red-50/50' : ''}`}>
                        <td className="px-5 py-3.5 font-bold text-slate-900">{d.purchase_number}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-700">{d.supplier_id?.name || '-'}</td>
                        <td className="px-5 py-3.5 text-slate-500">{fmtDate(d.purchased_at)}</td>
                        <td className={`px-5 py-3.5 font-semibold ${d.payment_status === 'overdue' ? 'text-red-700' : 'text-amber-700'}`}>
                          {d.due_date ? fmtDate(d.due_date) : '-'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">{fmt(d.total_actual)}</td>
                        <td className="px-5 py-3.5 text-green-700 font-semibold">{fmt(d.amount_paid)}</td>
                        <td className="px-5 py-3.5 font-black text-red-700">{fmt(d.amount_remaining)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${debtStatusBadge(d.payment_status)}`}>
                            {debtStatusLabel(d.payment_status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenPaymentModal(d)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              Bayar Hutang
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(d)}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                              title="Edit Transaksi / Tempo"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
