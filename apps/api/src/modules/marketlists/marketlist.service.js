const mongoose = require('mongoose');
const Marketlist = require('./marketlist.model');
const MarketlistItem = require('./marketlist-item.model');
const MarketlistApproval = require('../approvals/marketlist-approval.model');
const MarketlistNote = require('../notes/marketlist-note.model');
const Product = require('../products/product.model');
const ProductPrice = require('../prices/product-price.model');
const Invoice = require('../invoices/invoice.model');
const auditService = require('../audit/audit.service');
const { generateMarketlistNumber } = require('../../utils/number-generator');
const { MARKETLIST_STATUS, ROLES, PRICE_SOURCES } = require('@purchasing/constants');

class MarketlistService {
  async getAllMarketlists(query = {}, user = null) {
    const filter = {};
    if (query.status) {
      if (query.status.includes(',')) {
        filter.status = { $in: query.status.split(',').map((s) => s.trim()) };
      } else {
        filter.status = query.status;
      }
    } else if (user && [ROLES.RECEIVER, ROLES.LEADER, ROLES.STAFF].includes(user.role) && query.all !== 'true') {
      if (user.role === ROLES.LEADER) {
        filter.status = {
          $in: [
            MARKETLIST_STATUS.SUBMITTED,
            MARKETLIST_STATUS.APPROVED,
            MARKETLIST_STATUS.IN_PROGRESS,
            MARKETLIST_STATUS.PARTIALLY_RECEIVED,
            MARKETLIST_STATUS.RECEIVED,
            MARKETLIST_STATUS.COMPLETED
          ]
        };
      } else {
        filter.status = {
          $in: [
            MARKETLIST_STATUS.APPROVED,
            MARKETLIST_STATUS.IN_PROGRESS,
            MARKETLIST_STATUS.PARTIALLY_RECEIVED,
            MARKETLIST_STATUS.RECEIVED,
            MARKETLIST_STATUS.COMPLETED
          ]
        };
      }
      if (query.only_assigned === 'true') {
        filter.assigned_to = user._id;
      }
    }
    if (query.location_id) {
      filter.location_id = query.location_id;
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const skip = (page - 1) * limit;

    const [rawItems, total] = await Promise.all([
      Marketlist.find(filter)
        .populate('created_by', 'name email role')
        .populate('assigned_to', 'name email role')
        .populate('location_id', 'name code')
        .populate('approval.approved_by', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Marketlist.countDocuments(filter)
    ]);

    const mlIds = rawItems.map((m) => m._id);
    const existingInvoices = await Invoice.find({ marketlist_id: { $in: mlIds } })
      .select('_id invoice_number marketlist_id status grand_total supplier_id')
      .populate('supplier_id', 'name code')
      .lean();

    const invoiceMap = new Map();
    existingInvoices.forEach((inv) => {
      const mid = inv.marketlist_id ? inv.marketlist_id.toString() : '';
      if (mid) {
        if (!invoiceMap.has(mid)) invoiceMap.set(mid, []);
        invoiceMap.get(mid).push(inv);
      }
    });

    const items = await Promise.all(
      rawItems.map(async (ml) => {
        const mlItems = await MarketlistItem.find({ marketlist_id: ml._id })
          .populate({
            path: 'product_id',
            select: 'name unit_id category_id item_type sku specification last_purchase_price',
            populate: [
              { path: 'category_id', select: 'name code type' },
              { path: 'unit_id', select: 'name abbreviation' }
            ]
          })
          .populate('supplier_id', 'name code')
          .lean();
        const obj = ml.toObject ? ml.toObject() : ml;
        obj.items = mlItems;
        obj.invoices = invoiceMap.get(ml._id.toString()) || [];
        obj.has_invoice = obj.invoices.length > 0;
        return obj;
      })
    );

    return { items, total, page, limit };
  }

  async getMarketlistById(id) {
    const marketlist = await Marketlist.findById(id)
      .populate('created_by', 'name email role')
      .populate('assigned_to', 'name email role')
      .populate('location_id', 'name code address')
      .populate('approval.approved_by', 'name email');

    if (!marketlist) return null;

    const [items, note, approvals, invoices] = await Promise.all([
      MarketlistItem.find({ marketlist_id: id })
        .populate({
          path: 'product_id',
          select: 'name sku unit_id category_id item_type specification last_purchase_price',
          populate: [
            { path: 'category_id', select: 'name code type' },
            { path: 'unit_id', select: 'name abbreviation' }
          ]
        })
        .populate('supplier_id', 'name code contact_person phone'),
      MarketlistNote.findOne({ marketlist_id: id }).populate('updated_by', 'name email role'),
      MarketlistApproval.find({ marketlist_id: id }).populate('admin_id', 'name email').sort({ created_at: -1 }),
      Invoice.find({ marketlist_id: id }).populate('supplier_id', 'name code').lean()
    ]);

    return {
      ...marketlist.toObject(),
      items,
      note: note ? note.note : '',
      note_details: note,
      approvals,
      invoices: invoices || [],
      has_invoice: (invoices && invoices.length > 0)
    };
  }

  async createMarketlist(data, user) {
    const count = await Marketlist.countDocuments();
    const marketlist_number = generateMarketlistNumber(count + 1);

    const { date, required_date, location_id, assigned_to = [], items = [], notes = '' } = data;

    let totalQuantity = 0;
    let estimatedAmount = 0;

    // Fetch product master info for snapshots
    const productIds = items.map((i) => i.product_id);
    const products = await Product.find({ _id: { $in: productIds } }).populate('unit_id').populate('category_id');
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const preparedItems = items.map((item) => {
      const prod = productMap.get(item.product_id.toString());
      if (!prod) {
        throw new Error(`Product ID ${item.product_id} not found`);
      }

      const finalUnitPrice =
        prod.last_purchase_price && Number(prod.last_purchase_price) > 0
          ? Number(prod.last_purchase_price)
          : Number(item.unit_price) || 0;

      const subtotal = Number((item.requested_qty * finalUnitPrice).toFixed(2));
      totalQuantity += item.requested_qty;
      estimatedAmount += subtotal;

      return {
        product_id: prod._id,
        product_snapshot: {
          name: prod.name,
          sku: prod.sku,
          specification: prod.specification,
          unit_name: prod.unit_id ? prod.unit_id.name : '',
          item_type: prod.item_type || 'groceries',
          category_name: prod.category_id ? prod.category_id.name : 'Umum'
        },
        supplier_id: item.supplier_id || null,
        requested_qty: item.requested_qty,
        unit_price: finalUnitPrice,
        subtotal,
        notes: item.notes || '',
        version: 1
      };
    });

    const marketlist = new Marketlist({
      marketlist_number,
      date,
      required_date,
      location_id: location_id || null,
      created_by: user._id,
      assigned_to,
      status: MARKETLIST_STATUS.DRAFT,
      totals: {
        total_items: preparedItems.length,
        total_quantity: totalQuantity,
        estimated_amount: estimatedAmount
      },
      current_version: 1
    });

    await marketlist.save();

    // Save items with marketlist_id
    const itemDocs = preparedItems.map((pi) => ({ ...pi, marketlist_id: marketlist._id }));
    await MarketlistItem.insertMany(itemDocs);

    // Update last_purchase_price & last_supplier_id on products if provided
    for (const pi of preparedItems) {
      if (pi.unit_price > 0 && pi.supplier_id) {
        await Product.findByIdAndUpdate(pi.product_id, {
          last_purchase_price: pi.unit_price,
          last_supplier_id: pi.supplier_id
        }).catch(() => null);
      }
    }

    // Initialize single note document
    await MarketlistNote.create({
      marketlist_id: marketlist._id,
      note: notes,
      updated_by: user._id
    });

    // Record activity log
    await auditService.log({
      entity_type: 'marketlist',
      entity_id: marketlist._id,
      action: 'marketlist_created',
      performed_by: user._id,
      new_value: { marketlist_number, totals: marketlist.totals },
      description: `Marketlist ${marketlist_number} created in draft`
    });

    return this.getMarketlistById(marketlist._id);
  }

  async updateMarketlist(id, data, user) {
    const marketlist = await Marketlist.findById(id);
    if (!marketlist) {
      throw new Error('Marketlist not found');
    }

    if (![MARKETLIST_STATUS.DRAFT, MARKETLIST_STATUS.REVISION].includes(marketlist.status)) {
      throw new Error(`Marketlist with status '${marketlist.status}' cannot be edited directly.`);
    }

    const { date, required_date, location_id, assigned_to, items, notes } = data;

    if (date) marketlist.date = date;
    if (required_date) marketlist.required_date = required_date;
    if (location_id) marketlist.location_id = location_id;
    if (assigned_to) marketlist.assigned_to = assigned_to;

    if (items && items.length > 0) {
      await MarketlistItem.deleteMany({ marketlist_id: id });

      let totalQuantity = 0;
      let estimatedAmount = 0;

      const productIds = items.map((i) => i.product_id);
      const products = await Product.find({ _id: { $in: productIds } }).populate('unit_id');
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      const preparedItems = items.map((item) => {
        const prod = productMap.get(item.product_id.toString());
        const subtotal = Number((item.requested_qty * item.unit_price).toFixed(2));
        totalQuantity += item.requested_qty;
        estimatedAmount += subtotal;

        return {
          marketlist_id: id,
          product_id: item.product_id,
          product_snapshot: {
            name: prod?.name || '',
            sku: prod?.sku || '',
            specification: prod?.specification || '',
            unit_name: prod?.unit_id ? prod.unit_id.name : ''
          },
          supplier_id: item.supplier_id || null,
          requested_qty: item.requested_qty,
          unit_price: item.unit_price,
          subtotal,
          notes: item.notes || '',
          version: marketlist.current_version
        };
      });

      await MarketlistItem.insertMany(preparedItems);

      marketlist.totals = {
        total_items: preparedItems.length,
        total_quantity: totalQuantity,
        estimated_amount: estimatedAmount
      };
    }

    if (notes !== undefined) {
      await MarketlistNote.findOneAndUpdate(
        { marketlist_id: id },
        { note: notes, updated_by: user._id },
        { upsert: true }
      );
    }

    await marketlist.save();

    await auditService.log({
      entity_type: 'marketlist',
      entity_id: marketlist._id,
      action: 'marketlist_updated',
      performed_by: user._id,
      description: `Marketlist ${marketlist.marketlist_number} updated by ${user.name}`
    });

    return this.getMarketlistById(id);
  }

  async submitMarketlist(id, user) {
    const marketlist = await Marketlist.findById(id);
    if (!marketlist) throw new Error('Marketlist not found');

    if (![MARKETLIST_STATUS.DRAFT, MARKETLIST_STATUS.REVISION].includes(marketlist.status)) {
      throw new Error(`Cannot submit marketlist with status '${marketlist.status}'`);
    }

    const itemsCount = await MarketlistItem.countDocuments({ marketlist_id: id });
    if (itemsCount === 0) {
      throw new Error('Marketlist must contain at least one item before submission');
    }

    marketlist.status = MARKETLIST_STATUS.SUBMITTED;
    marketlist.submitted_at = new Date();
    await marketlist.save();

    await auditService.log({
      entity_type: 'marketlist',
      entity_id: marketlist._id,
      action: 'marketlist_submitted',
      performed_by: user._id,
      description: `Marketlist ${marketlist.marketlist_number} submitted to Admin`
    });

    return marketlist;
  }

  async approveMarketlist(id, adminUser, note = 'Marketlist disetujui.') {
    const marketlist = await Marketlist.findById(id);
    if (!marketlist) throw new Error('Marketlist not found');

    if (marketlist.status !== MARKETLIST_STATUS.SUBMITTED) {
      throw new Error(`Cannot approve marketlist with status '${marketlist.status}'. Status must be 'submitted'.`);
    }

    marketlist.status = MARKETLIST_STATUS.APPROVED;
    marketlist.approved_version = marketlist.current_version;
    marketlist.approval = {
      approved_by: adminUser._id,
      approved_at: new Date(),
      approval_note: note
    };

    await marketlist.save();

    // Record formal approval entry
    await MarketlistApproval.create({
      marketlist_id: marketlist._id,
      version: marketlist.current_version,
      action: 'approved',
      admin_id: adminUser._id,
      note
    });

    // Record price points in product_prices collection
    const items = await MarketlistItem.find({ marketlist_id: id });
    const priceEntries = items
      .filter((i) => i.supplier_id)
      .map((i) => ({
        product_id: i.product_id,
        supplier_id: i.supplier_id,
        price: i.unit_price,
        source: PRICE_SOURCES.MARKETLIST,
        reference_id: marketlist._id,
        recorded_at: new Date()
      }));

    if (priceEntries.length > 0) {
      await ProductPrice.insertMany(priceEntries);
    }

    await auditService.log({
      entity_type: 'marketlist',
      entity_id: marketlist._id,
      action: 'marketlist_approved',
      performed_by: adminUser._id,
      description: `Marketlist ${marketlist.marketlist_number} approved by Admin ${adminUser.name}`
    });

    return this.getMarketlistById(id);
  }

  async approveItems(marketlistId, itemDecisions = [], user) {
    const marketlist = await Marketlist.findById(marketlistId);
    if (!marketlist) throw new Error('Marketlist not found');
    if (![MARKETLIST_STATUS.SUBMITTED, MARKETLIST_STATUS.REVISION, MARKETLIST_STATUS.APPROVED].includes(marketlist.status)) {
      throw new Error(`Marketlist berstatus '${marketlist.status}' tidak dalam status yang dapat di-review per item`);
    }

    if (!Array.isArray(itemDecisions) || itemDecisions.length === 0) {
      return { success: true, updated: 0 };
    }

    const bulkOps = itemDecisions.map(({ id, approved, reason }) => ({
      updateOne: {
        filter: { _id: id, marketlist_id: marketlistId },
        update: {
          $set: {
            item_status: approved ? 'approved' : 'rejected',
            rejection_reason: approved ? '' : (reason || 'Ditolak oleh leader'),
            reviewed_by: user._id,
            reviewed_at: new Date()
          }
        }
      }
    }));

    if (bulkOps.length > 0) {
      await MarketlistItem.bulkWrite(bulkOps);
    }

    try {
      await auditService.log({
        entity_type: 'marketlist',
        entity_id: marketlist._id,
        action: 'marketlist_items_reviewed',
        performed_by: user._id,
        description: `Review ${itemDecisions.length} item marketlist oleh ${user.name || 'Leader'}`
      });
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log review items:', auditErr.message);
    }

    return { success: true, updated: bulkOps.length };
  }

  async rejectMarketlist(id, adminUser, reason) {
    const marketlist = await Marketlist.findById(id);
    if (!marketlist) throw new Error('Marketlist not found');

    if (marketlist.status !== MARKETLIST_STATUS.SUBMITTED) {
      throw new Error(`Cannot reject marketlist with status '${marketlist.status}'`);
    }

    marketlist.status = MARKETLIST_STATUS.CANCELLED;
    await marketlist.save();

    await MarketlistApproval.create({
      marketlist_id: marketlist._id,
      version: marketlist.current_version,
      action: 'rejected',
      admin_id: adminUser._id,
      note: reason
    });

    await auditService.log({
      entity_type: 'marketlist',
      entity_id: marketlist._id,
      action: 'marketlist_rejected',
      performed_by: adminUser._id,
      description: `Marketlist ${marketlist.marketlist_number} rejected: ${reason}`
    });

    return marketlist;
  }

  async requestRevision(id, adminUser, revisionNote) {
    const marketlist = await Marketlist.findById(id);
    if (!marketlist) throw new Error('Marketlist not found');

    if (marketlist.status !== MARKETLIST_STATUS.SUBMITTED) {
      throw new Error(`Cannot request revision for marketlist with status '${marketlist.status}'`);
    }

    marketlist.status = MARKETLIST_STATUS.REVISION;
    marketlist.current_version += 1;
    await marketlist.save();

    await MarketlistApproval.create({
      marketlist_id: marketlist._id,
      version: marketlist.current_version,
      action: 'revision',
      admin_id: adminUser._id,
      note: revisionNote
    });

    await auditService.log({
      entity_type: 'marketlist',
      entity_id: marketlist._id,
      action: 'marketlist_revision_requested',
      performed_by: adminUser._id,
      description: `Marketlist ${marketlist.marketlist_number} revision requested: ${revisionNote}`
    });

    return marketlist;
  }

  async getMarketlistAggregate(query = {}) {
    const { period = 'day' } = query;
    const now = new Date();
    let startDate = new Date();

    if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Default: today (1 hari ini)
      startDate.setHours(0, 0, 0, 0);
    }

    const marketlists = await Marketlist.find({
      date: { $gte: startDate, $lte: now }
    }).select('_id marketlist_number status date totals');

    const mlIds = marketlists.map((m) => m._id);

    if (mlIds.length === 0) {
      return {
        period,
        date_range: { start: startDate, end: now },
        total_marketlists: 0,
        total_items: 0,
        total_estimated_amount: 0,
        items: []
      };
    }

    const items = await MarketlistItem.find({
      marketlist_id: { $in: mlIds }
    }).populate({
      path: 'product_id',
      populate: [
        { path: 'category_id', select: 'name type' },
        { path: 'unit_id', select: 'name abbreviation' }
      ]
    });

    const itemMap = new Map();
    let grandTotalAmount = 0;

    for (const it of items) {
      const prod = it.product_id;
      const prodId = prod?._id?.toString() || it.product_name || 'unknown';
      const prodName = prod?.name || it.product_snapshot?.name || it.product_name || 'Barang';
      const catName = prod?.category_id?.name || 'Tanpa Kategori';
      const itemType = prod?.item_type || 'groceries';
      const unit = prod?.unit_id?.abbreviation || it.product_snapshot?.unit_name || 'KG';
      const qty = Number(it.requested_qty) || 0;
      const price = Number(it.unit_price) || 0;
      const subtotal = qty * price;

      grandTotalAmount += subtotal;

      if (!itemMap.has(prodId)) {
        itemMap.set(prodId, {
          product_id: prodId,
          name: prodName,
          category: catName,
          item_type: itemType,
          unit: unit,
          total_requested_qty: 0,
          total_received_qty: 0,
          marketlist_count: 0,
          marketlist_ids: new Set(),
          estimated_amount: 0
        });
      }

      const entry = itemMap.get(prodId);
      entry.total_requested_qty += qty;
      entry.total_received_qty += Number(it.received_qty) || 0;
      entry.estimated_amount += subtotal;
      entry.marketlist_ids.add(it.marketlist_id.toString());
    }

    const resultItems = Array.from(itemMap.values())
      .map((entry) => ({
        ...entry,
        marketlist_count: entry.marketlist_ids.size,
        marketlist_ids: undefined
      }))
      .sort((a, b) => b.total_requested_qty - a.total_requested_qty);

    return {
      period,
      date_range: { start: startDate, end: now },
      total_marketlists: marketlists.length,
      total_items: resultItems.length,
      total_estimated_amount: grandTotalAmount,
      items: resultItems
    };
  }
}

module.exports = new MarketlistService();

