export type UserRole = 'admin' | 'purchasing' | 'receiver' | 'accounting' | 'management' | 'leader' | 'staff';

export type MarketlistStatus =
  | 'draft'
  | 'submitted'
  | 'revision'
  | 'approved'
  | 'partial_rejection'
  | 'in_progress'
  | 'partially_received'
  | 'received'
  | 'completed'
  | 'cancelled';

export type ReceivingItemStatus = 'pending' | 'complete' | 'partial' | 'over_received' | 'rejected';
export type ItemCondition = 'good' | 'damaged' | 'incomplete' | 'expired' | 'other';
export type InvoiceStatus = 'draft' | 'generated' | 'verified' | 'partially_paid' | 'paid' | 'cancelled';
export type PriceSource = 'supplier_offer' | 'marketlist' | 'purchase_transaction' | 'purchase' | 'product_master';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  location_id?: string;
  is_active: boolean;
  createdAt: string;
}

export interface MarketlistItem {
  _id: string;
  marketlist_id: string;
  product_id: string;
  product_snapshot: {
    name: string;
    sku?: string;
    specification?: string;
    unit_name?: string;
  };
  supplier_id?: string;
  requested_qty: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
  version: number;
}

export interface Marketlist {
  _id: string;
  marketlist_number: string;
  date: string;
  required_date: string;
  location_id: string;
  created_by: string;
  assigned_to: string[];
  status: MarketlistStatus;
  totals: {
    total_items: number;
    total_quantity: number;
    estimated_amount: number;
  };
  approval?: {
    approved_by?: string;
    approved_at?: string;
    approval_note?: string;
  };
  approved_version?: number;
  current_version: number;
  items?: MarketlistItem[];
  note?: string;
}

export interface GoodsReceiptItem {
  _id: string;
  receipt_id: string;
  marketlist_item_id: string;
  ordered_qty: number;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  is_checked: boolean;
  status: ReceivingItemStatus;
  condition: ItemCondition;
  item_note?: string;
  evidence: Array<{ url: string; uploaded_at: string }>;
}

export interface GoodsReceipt {
  _id: string;
  receipt_number: string;
  client_request_id?: string;
  marketlist_id: string;
  received_by: string;
  supplier_id?: string;
  received_at: string;
  status: string;
  general_condition?: string;
  items: GoodsReceiptItem[];
}

export interface InvoiceItem {
  marketlist_item_id: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  subtotal: number;
}

export interface Invoice {
  _id: string;
  invoice_number: string;
  marketlist_id: string;
  supplier_id: string;
  marketlist_version: number;
  invoice_date: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grand_total: number;
  status: InvoiceStatus;
  pdf_url?: string;
  generated_by?: string;
  generated_at?: string;
}

export interface ProductPrice {
  product_id: string;
  supplier_id?: string;
  price: number;
  source: PriceSource;
  recorded_at?: string | null;
}

export interface WasteRecord {
  _id: string;
  product_id: string;
  product_name: string;
  unit_name: string;
  quantity: number;
  unit_purchase_price: number;
  total_cost: number;
  reason: string;
  wasted_at: string;
  recorded_by: string;
}
