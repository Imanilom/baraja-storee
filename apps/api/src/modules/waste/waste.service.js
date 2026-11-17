const mongoose = require('mongoose');
const Waste = require('./waste.model');
const Product = require('../products/product.model');
const ProductPrice = require('../prices/product-price.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const GoodsReceipt = require('../receiving/goods-receipt.model');
const GoodsReceiptItem = require('../receiving/goods-receipt-item.model');
const Location = require('../locations/location.model');
const Purchase = require('../purchases/purchase.model');
const PurchaseItem = require('../purchases/purchase-item.model');
const integrationService = require('../integrations/integration.service');
const { PRICE_SOURCES } = require('@purchasing/constants');

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

class WasteService {
  async listWaste(query = {}) {
    const filter = {};
    if (query.startDate || query.endDate) {
      filter.wasted_at = {};
      if (query.startDate) filter.wasted_at.$gte = new Date(query.startDate);
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        filter.wasted_at.$lte = endDate;
      }
    }

    return Waste.find(filter)
      .populate('product_id', 'name sku')
      .populate('marketlist_id', 'marketlist_number date required_date status')
      .populate('goods_receipt_id', 'receipt_number amphitheater_status')
      .populate('location_id', 'name code')
      .populate('recorded_by', 'name')
      .sort({ wasted_at: -1, createdAt: -1 })
      .limit(Math.min(Number(query.limit) || 100, 500));
  }

  async createWaste(data, user) {
    if (!mongoose.Types.ObjectId.isValid(data.product_id)) {
      throw new Error('Produk tidak valid.');
    }
    const quantity = Number(data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Jumlah waste harus lebih besar dari 0.');
    }
    const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
    if (!reason) {
      throw new Error('Alasan waste wajib diisi.');
    }
    const stage = data.stage || 'other';
    const validStages = ['received', 'processing', 'finished_product', 'spoiled', 'other'];
    if (!validStages.includes(stage)) {
      throw new Error('Tahap waste tidak valid.');
    }
    const isStockWaste = stage !== 'received';
    if (stage === 'received' && !data.marketlist_id) {
      throw new Error('Marketlist wajib dipilih untuk waste saat penerimaan.');
    }
    if (stage === 'received' && !data.goods_receipt_id) {
      throw new Error('Pilih penerimaan tertentu untuk waste saat penerimaan.');
    }
    if (stage === 'received' && !data.goods_receipt_item_id) {
      throw new Error('Pilih item pada penerimaan untuk waste saat penerimaan.');
    }
    if (stage === 'received' && !String(data.unit_name || '').trim()) {
      throw new Error('Satuan item penerimaan wajib dikonfirmasi untuk waste saat penerimaan.');
    }
    if (isStockWaste && (data.marketlist_id || data.marketlist_item_id)) {
      throw new Error('Waste setelah penerimaan dicatat dari stok, tanpa Marketlist.');
    }
    if (isStockWaste && !data.location_id) {
      throw new Error('Lokasi stok wajib dipilih agar waste tersinkron ke gudang Baraja Coffee.');
    }
    const notes = typeof data.notes === 'string' ? data.notes.trim() : '';
    if (notes.length > 1000) {
      throw new Error('Catatan waste maksimal 1000 karakter.');
    }

    const wastedAt = data.wasted_at ? new Date(data.wasted_at) : new Date();
    if (Number.isNaN(wastedAt.getTime())) {
      throw new Error('Tanggal waste tidak valid.');
    }

    const product = await Product.findById(data.product_id).populate('unit_id', 'name abbreviation');
    if (!product) {
      throw new Error('Produk tidak ditemukan.');
    }

    let marketlistItem = null;
    let goodsReceipt = null;
    let goodsReceiptItem = null;
    let location = null;
    if (data.marketlist_id) {
      if (!mongoose.Types.ObjectId.isValid(data.marketlist_id)) {
        throw new Error('Marketlist tidak valid.');
      }
      const marketlist = await Marketlist.findById(data.marketlist_id).select('_id status');
      if (!marketlist) throw new Error('Marketlist tidak ditemukan.');
      if (!mongoose.Types.ObjectId.isValid(data.goods_receipt_id)) {
        throw new Error('Penerimaan tidak valid.');
      }
      goodsReceipt = await GoodsReceipt.findOne({
        _id: data.goods_receipt_id,
        marketlist_id: marketlist._id
      }).select('_id status amphitheater_status');
      if (!goodsReceipt || goodsReceipt.status === 'cancelled') {
        throw new Error('Penerimaan tidak ditemukan atau sudah dibatalkan.');
      }
      if (['verified', 'pending_approval', 'approved', 'posted', 'reversed'].includes(goodsReceipt.amphitheater_status)) {
        throw httpError(409, 'Penerimaan sudah diverifikasi atau diposting di Baraja Coffee; waste penerimaan tidak dapat mengubah stoknya.');
      }
      if (!mongoose.Types.ObjectId.isValid(data.goods_receipt_item_id)) {
        throw new Error('Item penerimaan tidak valid.');
      }
      goodsReceiptItem = await GoodsReceiptItem.findOne({
        _id: data.goods_receipt_item_id,
        receipt_id: goodsReceipt._id
      }).populate({
        path: 'marketlist_item_id',
        select: 'marketlist_id product_id item_status product_snapshot'
      });
      if (!goodsReceiptItem || !goodsReceiptItem.marketlist_item_id) {
        throw new Error('Item penerimaan tidak ditemukan.');
      }
      marketlistItem = await MarketlistItem.findOne({
        _id: goodsReceiptItem.marketlist_item_id._id,
        marketlist_id: marketlist._id,
        product_id: product._id,
        item_status: { $ne: 'rejected' }
      }).select('_id');
      if (!marketlistItem) {
        throw new Error('Produk tidak sesuai dengan item pada penerimaan yang dipilih.');
      }
    } else if (data.marketlist_item_id) {
      throw new Error('Marketlist wajib dipilih untuk mengaitkan item waste.');
    }
    if (isStockWaste) {
      if (!mongoose.Types.ObjectId.isValid(data.location_id)) {
        throw new Error('Lokasi stok tidak valid.');
      }
      location = await Location.findOne({ _id: data.location_id, is_active: true }).select('_id');
      if (!location) throw new Error('Lokasi stok tidak ditemukan atau tidak aktif.');
    }

    const latestPurchasePrice = await ProductPrice.findOne({
      product_id: product._id,
      source: PRICE_SOURCES.PURCHASE
    }).sort({ recorded_at: -1 });
    const marketlistPurchases = data.marketlist_id
      ? await Purchase.find({
        marketlist_id: data.marketlist_id,
        status: 'verified'
      }).select('_id')
      : [];
    const marketlistPurchaseItem = marketlistItem && marketlistPurchases.length
      ? await PurchaseItem.findOne({
        purchase_id: { $in: marketlistPurchases.map((purchase) => purchase._id) },
        marketlist_item_id: marketlistItem._id
      }).sort({ createdAt: -1 })
      : null;
    if (stage === 'received' && !marketlistPurchaseItem) {
      throw new Error('Item pembelian terverifikasi untuk penerimaan ini tidak ditemukan.');
    }
    const wasteUnitName = isStockWaste
      ? product.unit_id?.abbreviation || product.unit_id?.name || ''
      : marketlistPurchaseItem.unit_name || product.unit_id?.abbreviation || product.unit_id?.name || '';
    if (stage === 'received' &&
        String(data.unit_name).trim().toLowerCase() !== wasteUnitName.trim().toLowerCase()) {
      throw new Error(`Satuan waste harus mengikuti satuan item penerimaan (${wasteUnitName}).`);
    }
    const unitPurchasePrice = Number(
      marketlistPurchaseItem?.actual_unit_price ||
      latestPurchasePrice?.price ||
      product.last_purchase_price ||
      0
    );
    if (unitPurchasePrice <= 0) {
      throw new Error('Produk belum memiliki harga pembelian. Catat transaksi pembelian terlebih dahulu.');
    }

    if (goodsReceiptItem) {
      const reservedItem = await GoodsReceiptItem.findOneAndUpdate(
        {
          _id: goodsReceiptItem._id,
          receipt_id: goodsReceipt._id,
          $expr: {
            $lte: [
              { $add: [{ $ifNull: ['$receiving_waste_qty', 0] }, quantity] },
              '$accepted_qty'
            ]
          }
        },
        { $inc: { receiving_waste_qty: quantity } },
        { new: true }
      );
      if (!reservedItem) {
        throw httpError(409, 'Jumlah waste melebihi kuantitas yang diterima atau sudah tercatat pada item ini.');
      }
    }

    let waste;
    try {
      [waste] = await Waste.create([{
        product_id: product._id,
        marketlist_id: data.marketlist_id || null,
        marketlist_item_id: marketlistItem?._id || null,
        goods_receipt_id: goodsReceipt?._id || null,
        location_id: location?._id || null,
        product_name: product.name,
        unit_name: wasteUnitName,
        quantity,
        unit_purchase_price: unitPurchasePrice,
        total_cost: quantity * unitPurchasePrice,
        stage,
        reason,
        notes,
        wasted_at: wastedAt,
        recorded_by: user._id,
        integration_status: isStockWaste ? 'sync_pending' : 'receipt_sync_pending'
      }]);
    } catch (error) {
      if (goodsReceiptItem) {
        await GoodsReceiptItem.updateOne(
          { _id: goodsReceiptItem._id },
          { $inc: { receiving_waste_qty: -quantity } }
        );
      }
      throw error;
    }

    try {
      if (isStockWaste) {
        await integrationService.enqueueWasteSync(waste._id);
      } else {
        await integrationService.enqueueGoodsReceiptSync(goodsReceipt._id, { force: true });
      }
    } catch (error) {
      await Waste.updateOne(
        { _id: waste._id },
        {
          $set: {
            integration_status: 'sync_failed',
            integration_last_sync_at: new Date(),
            integration_error: error.message.slice(0, 500)
          }
        }
      );
      console.error(`[Waste integration] Waste ${waste._id} could not be queued: ${error.message}`);
      waste.integration_status = 'sync_failed';
      waste.integration_error = error.message.slice(0, 500);
    }
    return Waste.findById(waste._id)
      .populate('goods_receipt_id', 'receipt_number amphitheater_status')
      .populate('location_id', 'name code');
  }

  async retryWasteSync(wasteId) {
    const waste = await Waste.findById(wasteId);
    if (!waste) throw httpError(404, 'Waste tidak ditemukan.');
    if (waste.stage === 'received') {
      const receipt = await GoodsReceipt.findById(waste.goods_receipt_id)
        .select('_id amphitheater_status');
      if (!receipt) throw httpError(409, 'Receipt waste tidak ditemukan untuk sinkronisasi ulang.');
      if (['verified', 'pending_approval', 'approved', 'posted', 'reversed'].includes(receipt.amphitheater_status)) {
        throw httpError(409, 'Receipt sudah maju di Baraja Coffee; waste penerimaan tidak dapat dikirim ulang.');
      }
      const event = await integrationService.enqueueGoodsReceiptSync(receipt._id, { force: true });
      await Waste.updateOne(
        { _id: waste._id },
        { $set: { integration_status: 'receipt_sync_pending', integration_error: '' } }
      );
      return { waste_id: waste._id, event_id: event.event_id, status: event.status };
    }
    if (waste.integration_status === 'synced') {
      throw httpError(409, 'Waste ini sudah tersinkron ke Baraja Coffee.');
    }
    const event = await integrationService.enqueueWasteSync(waste._id, { force: true });
    return { waste_id: waste._id, event_id: event.event_id, status: event.status };
  }
}

module.exports = new WasteService();
