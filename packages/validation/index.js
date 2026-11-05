const { z } = require('zod');
const { ROLES, MARKETLIST_STATUS, ITEM_CONDITION } = require('@purchasing/constants');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const zObjectId = z.string().regex(objectIdRegex, 'Invalid ObjectId');

// Auth validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(Object.values(ROLES)),
  location_id: zObjectId.optional()
});

// Master Data schemas
const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  category_id: zObjectId.optional(),
  unit_id: zObjectId,
  specification: z.string().optional(),
  is_active: z.boolean().optional()
});

const supplierSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  is_active: z.boolean().optional()
});

// Marketlist schemas
const marketlistItemInputSchema = z.object({
  product_id: zObjectId,
  requested_qty: z.number().gt(0, 'Quantity must be greater than zero'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
  supplier_id: zObjectId.optional(),
  notes: z.string().optional()
});

const createMarketlistSchema = z.object({
  date: z.string().or(z.date()),
  required_date: z.string().or(z.date()),
  location_id: zObjectId,
  assigned_to: z.array(zObjectId).optional(),
  items: z.array(marketlistItemInputSchema).min(1, 'Marketlist must have at least one item'),
  notes: z.string().optional()
});

const updateMarketlistSchema = z.object({
  date: z.string().or(z.date()).optional(),
  required_date: z.string().or(z.date()).optional(),
  location_id: zObjectId.optional(),
  assigned_to: z.array(zObjectId).optional(),
  items: z.array(marketlistItemInputSchema).min(1).optional(),
  notes: z.string().optional()
});

const approveMarketlistSchema = z.object({
  note: z.string().optional().default('Marketlist disetujui.')
});

const rejectMarketlistSchema = z.object({
  reason: z.string().min(1, 'Alasan penolakan wajib diisi')
});

const revisionMarketlistSchema = z.object({
  note: z.string().min(1, 'Catatan revisi wajib diisi')
});

// Marketlist Note schema (single note per marketlist)
const marketlistNoteSchema = z.object({
  note: z.string()
});

// Goods receipt (Mobile receiving) schema
const goodsReceiptItemInputSchema = z.object({
  marketlist_item_id: zObjectId,
  received_qty: z.number().min(0, 'Received qty cannot be negative'),
  accepted_qty: z.number().min(0, 'Accepted qty cannot be negative'),
  rejected_qty: z.number().min(0, 'Rejected qty cannot be negative').default(0),
  is_checked: z.boolean().default(true),
  condition: z.enum(Object.values(ITEM_CONDITION)).default(ITEM_CONDITION.GOOD),
  item_note: z.string().optional(),
  evidence: z.array(z.object({
    url: z.string().url(),
    uploaded_at: z.string().or(z.date()).optional()
  })).optional().default([])
});

const createGoodsReceiptSchema = z.object({
  supplier_id: zObjectId.optional(),
  client_request_id: z.string().optional(),
  general_condition: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string(),
    type: z.string().optional()
  })).optional().default([]),
  items: z.array(goodsReceiptItemInputSchema).min(1, 'Must include at least one receiving item')
});

// Generate Invoice schema
const generateInvoiceSchema = z.object({
  supplier_id: zObjectId.optional(), // If provided, only generates for this supplier. Otherwise generates for all suppliers in ML
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0)
});

module.exports = {
  zObjectId,
  loginSchema,
  registerUserSchema,
  productSchema,
  supplierSchema,
  marketlistItemInputSchema,
  createMarketlistSchema,
  updateMarketlistSchema,
  approveMarketlistSchema,
  rejectMarketlistSchema,
  revisionMarketlistSchema,
  marketlistNoteSchema,
  goodsReceiptItemInputSchema,
  createGoodsReceiptSchema,
  generateInvoiceSchema
};

