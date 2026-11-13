const Invoice = require('./invoice.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const GoodsReceipt = require('../receiving/goods-receipt.model');
const GoodsReceiptItem = require('../receiving/goods-receipt-item.model');
const Purchase = require('../purchases/purchase.model');
const PurchaseItem = require('../purchases/purchase-item.model');
const Supplier = require('../suppliers/supplier.model');
const auditService = require('../audit/audit.service');
const { generateInvoiceNumber } = require('../../utils/number-generator');
const { MARKETLIST_STATUS, INVOICE_STATUS, PURCHASE_STATUS } = require('@purchasing/constants');

class InvoiceService {
  async getPurchaseRecapPrices(marketlistId, supplierIds = []) {
    const filter = {
      marketlist_id: marketlistId,
      status: PURCHASE_STATUS.VERIFIED
    };
    if (supplierIds.length > 0) filter.supplier_id = { $in: supplierIds };
    const purchases = await Purchase.find(filter).select('_id supplier_id');
    const purchaseIds = purchases.map((purchase) => purchase._id);
    if (purchaseIds.length === 0) return new Map();

    const purchaseSupplierMap = new Map(
      purchases.map((purchase) => [purchase._id.toString(), purchase.supplier_id.toString()])
    );
    const purchaseItems = await PurchaseItem.find({
      purchase_id: { $in: purchaseIds }
    }).select('purchase_id marketlist_item_id actual_qty actual_unit_price');

    const weightedPrices = new Map();
    for (const purchaseItem of purchaseItems) {
      if (!purchaseItem.marketlist_item_id) continue;
      const supplierId = purchaseSupplierMap.get(purchaseItem.purchase_id.toString());
      const itemId = purchaseItem.marketlist_item_id.toString();
      const key = `${supplierId}:${itemId}`;
      const total = weightedPrices.get(key) || { quantity: 0, amount: 0 };
      total.quantity += Number(purchaseItem.actual_qty) || 0;
      if (purchaseItem.actual_qty > 0 && purchaseItem.actual_unit_price > 0) {
        total.amount += purchaseItem.actual_qty * purchaseItem.actual_unit_price;
      }
      weightedPrices.set(key, total);
    }

    return new Map(
      [...weightedPrices].map(([key, total]) => [
        key,
        {
          quantity: total.quantity,
          unit_price: total.quantity > 0 ? total.amount / total.quantity : null,
          price_source: total.quantity > 0 && total.amount > 0 ? 'purchase_recap' : null
        }
      ])
    );
  }

  async getManualPurchaseItems(marketlistId) {
    const purchases = await Purchase.find({
      marketlist_id: marketlistId,
      status: PURCHASE_STATUS.VERIFIED
    }).select('_id supplier_id');
    if (purchases.length === 0) return [];

    const purchaseSupplierMap = new Map(
      purchases.map((purchase) => [purchase._id.toString(), purchase.supplier_id])
    );
    const items = await PurchaseItem.find({
      purchase_id: { $in: purchases.map((purchase) => purchase._id) },
      marketlist_item_id: null
    }).populate({
      path: 'product_id',
      select: 'name sku unit_id',
      populate: { path: 'unit_id', select: 'name abbreviation' }
    });
    return items.map((item) => ({
      ...item.toObject(),
      supplier_id: purchaseSupplierMap.get(item.purchase_id.toString())
    }));
  }

  getInvoiceItemKey(item, defaultSupplierId = null) {
    return item.marketlist_item_id
      ? `marketlist:${(item.supplier_id || defaultSupplierId)?.toString() || ''}:${item.marketlist_item_id.toString()}`
      : `purchase:${item.purchase_item_id.toString()}`;
  }

  getInvoiceItemPrice(item, supplierId, purchasePrices) {
    const purchasePrice = supplierId
      ? purchasePrices.get(`${supplierId}:${item._id.toString()}`)
      : null;
    if (purchasePrice?.unit_price > 0) return purchasePrice;
    if (Number(item.product_id?.last_purchase_price) > 0) {
      return {
        unit_price: Number(item.product_id.last_purchase_price),
        price_source: 'master_item'
      };
    }
    return { unit_price: Number(item.unit_price) || 0, price_source: 'marketlist' };
  }

  async getAllInvoices(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    else filter.status = { $ne: INVOICE_STATUS.CANCELLED };
    if (query.supplier_id) {
      filter.$or = [
        { supplier_id: query.supplier_id },
        { 'items.supplier_id': query.supplier_id }
      ];
    }
    if (query.marketlist_id) filter.marketlist_id = query.marketlist_id;

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Invoice.find(filter)
        .populate('supplier_id', 'name code phone')
        .populate('marketlist_id', 'marketlist_number required_date status')
        .populate('generated_by', 'name email role')
        .sort({ invoice_date: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(filter)
    ]);

    return { items, total, page, limit };
  }

  async getInvoiceById(id) {
    return Invoice.findById(id)
      .populate('supplier_id', 'name code contact_person phone email address bank_account')
      .populate('marketlist_id', 'marketlist_number required_date status approval location_id')
      .populate('generated_by', 'name email role');
  }

  async generateInvoicesFromMarketlist(marketlistId, options = {}, user) {
    const marketlist = await Marketlist.findById(marketlistId);
    if (!marketlist) {
      throw new Error('Marketlist not found');
    }

    // Must be approved before invoice can be generated
    const allowedStatuses = [
      MARKETLIST_STATUS.APPROVED,
      MARKETLIST_STATUS.PARTIAL_REJECTION,
      MARKETLIST_STATUS.IN_PROGRESS,
      MARKETLIST_STATUS.PARTIALLY_RECEIVED,
      MARKETLIST_STATUS.RECEIVED,
      MARKETLIST_STATUS.COMPLETED
    ];

    if (!allowedStatuses.includes(marketlist.status)) {
      throw new Error(
        `Cannot generate invoice. Marketlist status is '${marketlist.status}'. Only approved marketlists can generate invoices.`
      );
    }

    const version = marketlist.approved_version || marketlist.current_version;

    // Fetch marketlist items
    const mlItems = await MarketlistItem.find({ marketlist_id: marketlistId }).populate('product_id');
    if (mlItems.length === 0) {
      throw new Error('Marketlist has no items to invoice');
    }

    // Fetch any goods receipts for this marketlist to get actual received/accepted quantities
    const allReceipts = await GoodsReceipt.find({
      marketlist_id: marketlistId,
      status: { $ne: 'cancelled' }
    });
    const receiptIds = allReceipts.map((r) => r._id);
    const allReceiptItems = receiptIds.length > 0
      ? await GoodsReceiptItem.find({ receipt_id: { $in: receiptIds } })
      : [];

    const acceptedMap = new Map();
    allReceiptItems.forEach((ri) => {
      const k = ri.marketlist_item_id ? ri.marketlist_item_id.toString() : '';
      if (k) {
        const qty = Number(ri.accepted_qty !== undefined ? ri.accepted_qty : (ri.received_qty || 0));
        acceptedMap.set(k, (acceptedMap.get(k) || 0) + qty);
      }
    });

    const candidateItems = mlItems.filter((item) => item.item_status !== 'rejected');
    const existingInvoices = await Invoice.find({
      marketlist_id: marketlistId,
      marketlist_version: version
    }).sort({ createdAt: 1 });
    // Resolve missing suppliers using receipt and product history.
    let defaultSupplierId = null;
    for (const item of candidateItems) {
      if (!item.supplier_id) {
        if (!defaultSupplierId) {
          const recWithSupp = allReceipts.find((r) => r.supplier_id);
          if (recWithSupp?.supplier_id) {
            defaultSupplierId = recWithSupp.supplier_id;
          } else if (item.product_id?.last_supplier_id) {
            defaultSupplierId = item.product_id.last_supplier_id;
          } else {
            let supp = await Supplier.findOne({ is_active: true });
            if (!supp) {
              supp = await Supplier.create({ name: 'Supplier Umum', code: 'SUPP-UMUM', is_active: true });
            }
            defaultSupplierId = supp._id;
          }
        }
        item.supplier_id = defaultSupplierId;
      }
    }

    const purchasePrices = await this.getPurchaseRecapPrices(marketlistId);
    const manualPurchaseItems = await this.getManualPurchaseItems(marketlistId);
    const hasPurchaseRecap = marketlist.purchase_tracking_started || purchasePrices.size > 0 || manualPurchaseItems.length > 0;
    const getActualQuantity = (item, supplierId = item.supplier_id.toString()) => {
      const recap = purchasePrices.get(`${supplierId}:${item._id.toString()}`);
      if (hasPurchaseRecap) return recap?.quantity || 0;
      return acceptedMap.get(item._id.toString()) || 0;
    };
    const supplierIds = new Set([
      ...candidateItems.map((item) => item.supplier_id?.toString()).filter(Boolean),
      ...[...purchasePrices.keys()].map((key) => key.split(':')[0]),
      ...manualPurchaseItems.map((item) => item.supplier_id?.toString()).filter(Boolean),
      ...existingInvoices.map((invoice) => invoice.supplier_id?.toString()).filter(Boolean)
    ]);
    const suppliers = supplierIds.size > 0
      ? await Supplier.find({ _id: { $in: [...supplierIds] } }).select('name')
      : [];
    const supplierNameMap = new Map(
      suppliers.map((supplier) => [supplier._id.toString(), supplier.name])
    );
    const invoiceItems = [];

    if (hasPurchaseRecap) {
      for (const item of candidateItems) {
        const itemId = item._id.toString();
        for (const [key, recap] of purchasePrices) {
          const separator = key.indexOf(':');
          const supplierId = key.slice(0, separator);
          if (key.slice(separator + 1) !== itemId || recap.quantity <= 0) continue;
          const price = this.getInvoiceItemPrice(item, supplierId, purchasePrices);
          invoiceItems.push({
            marketlist_item_id: item._id,
            supplier_id: supplierId,
            supplier_name: supplierNameMap.get(supplierId) || 'Supplier',
            product_id: item.product_id?._id || item.product_id,
            product_name: item.product_snapshot?.name || item.product_id?.name || 'Item',
            sku: item.product_snapshot?.sku || '',
            quantity: recap.quantity,
            purchased: true,
            unit: item.product_snapshot?.unit_name || '',
            unit_price: price.unit_price,
            price_source: price.price_source,
            subtotal: recap.quantity * price.unit_price
          });
        }
      }

      for (const item of manualPurchaseItems) {
        const quantity = Number(item.actual_qty) || 0;
        if (quantity <= 0) continue;
        const supplierId = item.supplier_id?.toString();
        const unitPrice = Number(item.actual_unit_price) || 0;
        invoiceItems.push({
          purchase_item_id: item._id,
          supplier_id: supplierId,
          supplier_name: supplierNameMap.get(supplierId) || 'Supplier',
          product_id: item.product_id?._id || item.product_id,
          product_name: item.product_name || item.product_id?.name || 'Item Manual',
          sku: item.product_id?.sku || '',
          quantity,
          purchased: true,
          unit: item.unit_name || item.product_id?.unit_id?.name || '',
          unit_price: unitPrice,
          price_source: 'purchase_recap',
          subtotal: quantity * unitPrice
        });
      }
    } else {
      for (const item of candidateItems) {
        const quantity = getActualQuantity(item);
        if (quantity <= 0) continue;
        const supplierId = item.supplier_id?.toString();
        const price = this.getInvoiceItemPrice(item, supplierId, purchasePrices);
        invoiceItems.push({
          marketlist_item_id: item._id,
          supplier_id: supplierId,
          supplier_name: supplierNameMap.get(supplierId) || 'Supplier',
          product_id: item.product_id?._id || item.product_id,
          product_name: item.product_snapshot?.name || item.product_id?.name || 'Item',
          sku: item.product_snapshot?.sku || '',
          quantity,
          purchased: true,
          unit: item.product_snapshot?.unit_name || '',
          unit_price: price.unit_price,
          price_source: price.price_source,
          subtotal: quantity * price.unit_price
        });
      }
    }

    const activeInvoices = existingInvoices.filter(
      (invoice) => invoice.status === INVOICE_STATUS.GENERATED
    );
    const reusableInvoice = activeInvoices.find((invoice) => !invoice.supplier_id) ||
      existingInvoices.find((invoice) =>
        !invoice.supplier_id && invoice.status === INVOICE_STATUS.CANCELLED
      ) ||
      activeInvoices[0];
    const verifiedInvoice = existingInvoices.find(
      (invoice) => invoice.status === INVOICE_STATUS.VERIFIED && !invoice.supplier_id
    ) || existingInvoices.find((invoice) => invoice.status === INVOICE_STATUS.VERIFIED);

    if (verifiedInvoice && !verifiedInvoice.supplier_id) return [verifiedInvoice];
    if (activeInvoices.length === 0 && verifiedInvoice) return [verifiedInvoice];

    if (invoiceItems.length === 0 && !reusableInvoice) {
      throw new Error('No accepted goods or purchases exist for this marketlist');
    }

    if (invoiceItems.length === 0) {
      for (const invoice of activeInvoices) {
        invoice.items = [];
        invoice.subtotal = 0;
        invoice.discount = 0;
        invoice.tax = 0;
        invoice.grand_total = 0;
        invoice.status = INVOICE_STATUS.CANCELLED;
        await invoice.save();
        await auditService.log({
          entity_type: 'invoice',
          entity_id: invoice._id,
          action: 'invoice_cancelled',
          performed_by: user._id,
          description: `Invoice ${invoice.invoice_number} cancelled because no purchased items remain for its Marketlist`
        });
      }
      return activeInvoices;
    }

    let targetInvoice = reusableInvoice;
    if (!targetInvoice) {
      const count = await Invoice.countDocuments();
      targetInvoice = new Invoice({
        invoice_number: generateInvoiceNumber(count + 1),
        marketlist_id: marketlist._id,
        supplier_id: null,
        marketlist_version: version,
        invoice_date: new Date(),
        discount: options.discount || 0,
        tax: options.tax || 0,
        status: INVOICE_STATUS.GENERATED,
        generated_by: user._id,
        generated_at: new Date()
      });
    }

    if (targetInvoice.status !== INVOICE_STATUS.VERIFIED) {
      const siblingInvoices = activeInvoices.filter(
        (invoice) => invoice._id.toString() !== targetInvoice._id.toString()
      );
      const preserveConfirmedItems =
        activeInvoices.some((invoice) => invoice.purchases_confirmed === true) &&
        options.syncPurchases !== true;

      if (preserveConfirmedItems) {
        const mergedItems = new Map();
        for (const sourceInvoice of [targetInvoice, ...siblingInvoices]) {
          for (const sourceItem of sourceInvoice.items) {
            if (
              sourceInvoice !== targetInvoice &&
              (sourceItem.purchased === false || sourceItem.quantity <= 0)
            ) {
              continue;
            }
            const supplierId = sourceItem.supplier_id || sourceInvoice.supplier_id;
            const item = {
              ...sourceItem.toObject(),
              supplier_id: supplierId,
              supplier_name: sourceItem.supplier_name ||
                supplierNameMap.get(supplierId?.toString()) ||
                sourceInvoice.supplier_id?.name ||
                'Supplier'
            };
            const key = this.getInvoiceItemKey(item);
            if (!mergedItems.has(key)) mergedItems.set(key, item);
          }
        }
        targetInvoice.items = [...mergedItems.values()];
      } else {
        targetInvoice.items = invoiceItems;
      }

      targetInvoice.marketlist_id = marketlist._id;
      targetInvoice.supplier_id = null;
      targetInvoice.marketlist_version = version;
      targetInvoice.subtotal = targetInvoice.items.reduce((sum, item) => sum + item.subtotal, 0);
      if (!preserveConfirmedItems) {
        targetInvoice.discount = options.discount || 0;
        targetInvoice.tax = options.tax || 0;
      }
      targetInvoice.grand_total =
        targetInvoice.subtotal - targetInvoice.discount + targetInvoice.tax;
      targetInvoice.status = INVOICE_STATUS.GENERATED;
      if (options.syncPurchases === true) targetInvoice.purchases_confirmed = false;
      else if (preserveConfirmedItems) targetInvoice.purchases_confirmed = true;
      await targetInvoice.save();

      for (const duplicate of siblingInvoices) {
        duplicate.items = [];
        duplicate.subtotal = 0;
        duplicate.discount = 0;
        duplicate.tax = 0;
        duplicate.grand_total = 0;
        duplicate.status = INVOICE_STATUS.CANCELLED;
        await duplicate.save();
        await auditService.log({
          entity_type: 'invoice',
          entity_id: duplicate._id,
          action: 'invoice_cancelled',
          performed_by: user._id,
          description: `Invoice ${duplicate.invoice_number} cancelled after consolidating Marketlist ${marketlist.marketlist_number}`
        });
      }
    } else {
      const count = await Invoice.countDocuments();
      targetInvoice = new Invoice({
        invoice_number: generateInvoiceNumber(count + 1),
        marketlist_id: marketlist._id,
        supplier_id: null,
        marketlist_version: version,
        invoice_date: new Date(),
        items: invoiceItems,
        subtotal: invoiceItems.reduce((sum, item) => sum + item.subtotal, 0),
        discount: options.discount || 0,
        tax: options.tax || 0,
        grand_total: 0,
        status: INVOICE_STATUS.GENERATED,
        generated_by: user._id,
        generated_at: new Date()
      });
      targetInvoice.grand_total = targetInvoice.subtotal - targetInvoice.discount + targetInvoice.tax;
      await targetInvoice.save();
      await auditService.log({
        entity_type: 'invoice',
        entity_id: targetInvoice._id,
        action: 'invoice_generated',
        performed_by: user._id,
        new_value: { invoice_number: targetInvoice.invoice_number, grand_total: targetInvoice.grand_total },
        description: `Generated consolidated invoice ${targetInvoice.invoice_number} from Marketlist ${marketlist.marketlist_number}`
      });
    }

    return [targetInvoice];
  }

  async syncMarketlistPurchaseQuantities(marketlistId, user) {
    const invoiceCount = await Invoice.countDocuments({
      marketlist_id: marketlistId,
      status: INVOICE_STATUS.GENERATED
    });
    if (invoiceCount === 0) {
      const purchases = await Purchase.find({
        marketlist_id: marketlistId,
        status: PURCHASE_STATUS.VERIFIED
      }).select('_id');
      if (purchases.length === 0) return [];

      const hasPurchasedItems = await PurchaseItem.exists({
        purchase_id: { $in: purchases.map((purchase) => purchase._id) },
        actual_qty: { $gt: 0 }
      });
      if (!hasPurchasedItems) return [];
    }

    return this.generateInvoicesFromMarketlist(
      marketlistId,
      { syncPurchases: true },
      user
    );
  }

  async regenerateAllInvoices(user) {
    const eligibleStatuses = [
      MARKETLIST_STATUS.APPROVED,
      MARKETLIST_STATUS.PARTIAL_REJECTION,
      MARKETLIST_STATUS.IN_PROGRESS,
      MARKETLIST_STATUS.PARTIALLY_RECEIVED,
      MARKETLIST_STATUS.RECEIVED,
      MARKETLIST_STATUS.COMPLETED
    ];
    const marketlists = await Marketlist.find({ status: { $in: eligibleStatuses } })
      .select('_id');
    const marketlistIds = marketlists.map((marketlist) => marketlist._id);
    if (marketlistIds.length === 0) return [];

    const [invoiceMarketlistIds, purchaseMarketlistIds, receiptMarketlistIds] = await Promise.all([
      Invoice.distinct('marketlist_id', {
        marketlist_id: { $in: marketlistIds },
        status: INVOICE_STATUS.GENERATED
      }),
      Purchase.distinct('marketlist_id', { marketlist_id: { $in: marketlistIds } }),
      GoodsReceipt.distinct('marketlist_id', {
        marketlist_id: { $in: marketlistIds },
        status: { $ne: 'cancelled' }
      })
    ]);
    const eligibleIds = new Set(
      [...invoiceMarketlistIds, ...purchaseMarketlistIds, ...receiptMarketlistIds]
        .map((id) => id.toString())
    );

    const results = [];
    for (const marketlistId of marketlistIds) {
      if (!eligibleIds.has(marketlistId.toString())) continue;
      const invoices = await this.generateInvoicesFromMarketlist(
        marketlistId,
        { syncPurchases: true },
        user
      );
      results.push(...invoices);
    }
    return results;
  }

  async verifyInvoice(id, user) {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new Error('Invoice not found');

    invoice.status = INVOICE_STATUS.VERIFIED;
    await invoice.save();

    await auditService.log({
      entity_type: 'invoice',
      entity_id: invoice._id,
      action: 'invoice_verified',
      performed_by: user._id,
      description: `Invoice ${invoice.invoice_number} verified by ${user.name}`
    });

    return invoice;
  }

  async updateInvoiceItems(id, data, user) {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.status !== INVOICE_STATUS.GENERATED) {
      throw new Error('Only generated invoices can be edited');
    }

    const existingItems = new Map(invoice.items.map((item) => [
      this.getInvoiceItemKey(item, invoice.supplier_id),
      item
    ]));
    const updates = new Map();
    for (const input of data.items) {
      const itemId = input.marketlist_item_id
        ? `marketlist:${(input.supplier_id || invoice.supplier_id)?.toString() || ''}:${input.marketlist_item_id.toString()}`
        : `purchase:${input.purchase_item_id.toString()}`;
      if (!existingItems.has(itemId) || updates.has(itemId)) {
        throw new Error('Invoice item not found or duplicated');
      }
      if (input.purchased && input.quantity <= 0) {
        throw new Error('Purchased items must have a quantity greater than zero');
      }
      updates.set(itemId, input);
    }
    if (updates.size !== existingItems.size) {
      throw new Error('All invoice items must be included in the update');
    }

    const previousItems = invoice.items.map((item) => ({
      marketlist_item_id: item.marketlist_item_id,
      purchased: item.purchased !== false,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    }));
    let subtotal = 0;
    invoice.items = invoice.items.map((item) => {
      const update = updates.get(this.getInvoiceItemKey(item));
      const purchased = update.purchased;
      const quantity = purchased ? update.quantity : 0;
      const unitPrice = update.unit_price;
      const itemSubtotal = quantity * unitPrice;
      subtotal += itemSubtotal;
      return {
        marketlist_item_id: item.marketlist_item_id,
        purchase_item_id: item.purchase_item_id,
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name,
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        purchased,
        quantity,
        unit: item.unit,
        unit_price: unitPrice,
        price_source: 'manual',
        subtotal: itemSubtotal
      };
    });
    invoice.subtotal = subtotal;
    invoice.grand_total = subtotal - invoice.discount + invoice.tax;
    invoice.purchases_confirmed = true;
    await invoice.save();

    await auditService.log({
      entity_type: 'invoice',
      entity_id: invoice._id,
      action: 'invoice_items_updated',
      performed_by: user._id,
      old_value: previousItems,
      new_value: invoice.items.map((item) => ({
        marketlist_item_id: item.marketlist_item_id,
        purchased: item.purchased,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal
      })),
      description: `Invoice ${invoice.invoice_number} purchase quantities updated`
    });
    return invoice;
  }

  async refreshInvoicePrices(id, user) {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== INVOICE_STATUS.GENERATED) {
      throw new Error('Only generated invoices can refresh prices');
    }

    const marketlistItems = await MarketlistItem.find({
      _id: { $in: invoice.items.map((item) => item.marketlist_item_id).filter(Boolean) }
    }).populate('product_id', 'last_purchase_price');
    const marketlistItemMap = new Map(
      marketlistItems.map((item) => [item._id.toString(), item])
    );
    const purchasePrices = await this.getPurchaseRecapPrices(
      invoice.marketlist_id
    );
    const previousItems = invoice.items.map((item) => ({
      marketlist_item_id: item.marketlist_item_id,
      purchase_item_id: item.purchase_item_id,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    }));

    let subtotal = 0;
    invoice.items = invoice.items.map((invoiceItem) => {
      if (invoiceItem.purchase_item_id) {
        const itemSubtotal = invoiceItem.quantity * invoiceItem.unit_price;
        subtotal += itemSubtotal;
        return {
          ...invoiceItem.toObject(),
          subtotal: itemSubtotal
        };
      }
      const marketlistItem = marketlistItemMap.get(invoiceItem.marketlist_item_id.toString());
      if (!marketlistItem) {
        throw new Error(`Marketlist item for '${invoiceItem.product_name}' was not found`);
      }
      const price = this.getInvoiceItemPrice(
        marketlistItem,
        invoiceItem.supplier_id?.toString() || invoice.supplier_id?.toString(),
        purchasePrices
      );
      const itemSubtotal = invoiceItem.quantity * price.unit_price;
      subtotal += itemSubtotal;
      return {
        marketlist_item_id: invoiceItem.marketlist_item_id,
        purchase_item_id: invoiceItem.purchase_item_id,
        supplier_id: invoiceItem.supplier_id,
        supplier_name: invoiceItem.supplier_name,
        product_id: invoiceItem.product_id,
        product_name: invoiceItem.product_name,
        sku: invoiceItem.sku,
        quantity: invoiceItem.quantity,
        purchased: invoiceItem.purchased,
        unit: invoiceItem.unit,
        unit_price: price.unit_price,
        price_source: price.price_source,
        subtotal: itemSubtotal
      };
    });
    invoice.subtotal = subtotal;
    invoice.grand_total = subtotal - invoice.discount + invoice.tax;
    await invoice.save();

    await auditService.log({
      entity_type: 'invoice',
      entity_id: invoice._id,
      action: 'invoice_prices_refreshed',
      performed_by: user._id,
      old_value: previousItems,
      new_value: invoice.items.map((item) => ({
        marketlist_item_id: item.marketlist_item_id,
        unit_price: item.unit_price,
        price_source: item.price_source,
        subtotal: item.subtotal
      })),
      description: `Invoice ${invoice.invoice_number} unit prices refreshed from purchase recap and master items`
    });
    return invoice;
  }
}

module.exports = new InvoiceService();
