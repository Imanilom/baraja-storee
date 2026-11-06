const mongoose = require('mongoose');
const Marketlist = require('./marketlist.model');
const MarketlistItem = require('./marketlist-item.model');
const MarketlistApproval = require('../approvals/marketlist-approval.model');
const MarketlistNote = require('../notes/marketlist-note.model');
const Product = require('../products/product.model');
const ProductPrice = require('../prices/product-price.model');
const auditService = require('../audit/audit.service');
const { generateMarketlistNumber } = require('../../utils/number-generator');
const { MARKETLIST_STATUS, ROLES, PRICE_SOURCES } = require('@purchasing/constants');

class MarketlistService {
  async getAllMarketlists(query = {}, user = null) {
    const filter = {};
    if (query.status) {
      filter.status = query.status;
    } else if (user && user.role === ROLES.RECEIVER && query.all !== 'true') {
      filter.status = { $in: [MARKETLIST_STATUS.APPROVED, MARKETLIST_STATUS.IN_PROGRESS, MARKETLIST_STATUS.PARTIALLY_RECEIVED] };
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

    const items = await Promise.all(
      rawItems.map(async (ml) => {
        const mlItems = await MarketlistItem.find({ marketlist_id: ml._id })
          .populate('product_id', 'name unit_id sku')
          .populate('supplier_id', 'name code')
          .lean();
        const obj = ml.toObject ? ml.toObject() : ml;
        obj.items = mlItems;
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

    const [items, note, approvals] = await Promise.all([
      MarketlistItem.find({ marketlist_id: id })
        .populate('product_id', 'name sku unit_id specification')
        .populate('supplier_id', 'name code contact_person phone'),
      MarketlistNote.findOne({ marketlist_id: id }).populate('updated_by', 'name email role'),
      MarketlistApproval.find({ marketlist_id: id }).populate('admin_id', 'name email').sort({ created_at: -1 })
    ]);

    return {
      ...marketlist.toObject(),
      items,
      note: note ? note.note : '',
      note_details: note,
      approvals
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
    const products = await Product.find({ _id: { $in: productIds } }).populate('unit_id');
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
          unit_name: prod.unit_id ? prod.unit_id.name : ''
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
      location_id,
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
}

module.exports = new MarketlistService();

