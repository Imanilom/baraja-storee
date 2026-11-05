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
  PRICE_SOURCES
};
