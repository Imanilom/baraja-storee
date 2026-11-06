const ROLES = {
  ADMIN: 'admin',
  PURCHASING: 'purchasing',
  RECEIVER: 'receiver',
  ACCOUNTING: 'accounting',
  MANAGEMENT: 'management'
};

const MARKETLIST_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  REVISION: 'revision',
  APPROVED: 'approved',
  IN_PROGRESS: 'in_progress',
  PARTIALLY_RECEIVED: 'partially_received',
  RECEIVED: 'received',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const RECEIVING_STATUS = {
  PENDING: 'pending',
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  OVER_RECEIVED: 'over_received',
  REJECTED: 'rejected'
};

const GOODS_RECEIPT_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  CANCELLED: 'cancelled'
};

const ITEM_CONDITION = {
  GOOD: 'good',
  DAMAGED: 'damaged',
  INCOMPLETE: 'incomplete',
  EXPIRED: 'expired',
  OTHER: 'other'
};

const INVOICE_STATUS = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  VERIFIED: 'verified',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  CANCELLED: 'cancelled'
};

const PURCHASE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified'
};

const PAYMENT_STATUS = {
  PAID: 'paid',          // Lunas
  UNPAID: 'unpaid',      // Belum bayar (hutang)
  PARTIAL: 'partial',    // Bayar sebagian
  OVERDUE: 'overdue'     // Jatuh tempo / lewat tanggal
};

const PAYMENT_METHOD = {
  CASH: 'cash',
  TRANSFER: 'transfer',
  TEMPO: 'tempo'         // Hutang / kredit
};

const OVERHEAD_CATEGORIES = {
  LISTRIK_AIR_GAS: 'listrik_air_gas',
  SEWA_TEMPAT: 'sewa_tempat',
  GAJI_UPAH: 'gaji_upah',
  LOGISTIK_TRANSPORT: 'logistik_transport',
  KEMASAN_PACKAGING: 'kemasan_packaging',
  PEMELIHARAAN_ASET: 'pemeliharaan_aset',
  KEBERSIHAN_KEAMANAN: 'kebersihan_keamanan',
  INTERNET_UTILITAS: 'internet_utilitas',
  MARKETING_PROMOSI: 'marketing_promosi',
  LAIN_LAIN: 'lain_lain'
};

const OVERHEAD_CATEGORY_LABELS = {
  listrik_air_gas: 'Listrik, Air & Gas',
  sewa_tempat: 'Sewa Tempat / Outlet',
  gaji_upah: 'Gaji & Upah Karyawan',
  logistik_transport: 'Logistik & Bahan Bakar',
  kemasan_packaging: 'Packaging & Kemasan',
  pemeliharaan_aset: 'Maintenance & Servis Mesin',
  kebersihan_keamanan: 'Kebersihan & Keamanan',
  internet_utilitas: 'Internet & Software',
  marketing_promosi: 'Marketing & Promosi',
  lain_lain: 'Lain-lain / Operasional'
};

const PRICE_SOURCES = {
  SUPPLIER_OFFER: 'supplier_offer',
  MARKETLIST: 'marketlist',
  PURCHASE_TRANSACTION: 'purchase_transaction'
};

module.exports = {
  ROLES,
  MARKETLIST_STATUS,
  RECEIVING_STATUS,
  GOODS_RECEIPT_STATUS,
  ITEM_CONDITION,
  INVOICE_STATUS,
  PURCHASE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  OVERHEAD_CATEGORIES,
  OVERHEAD_CATEGORY_LABELS,
  PRICE_SOURCES
};

