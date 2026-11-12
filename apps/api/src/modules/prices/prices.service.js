const ProductPrice = require('./product-price.model');
const Product = require('../products/product.model');

class PriceService {
  async getPriceHistoryByProduct(productId, limit = 20) {
    return ProductPrice.find({ product_id: productId })
      .populate('supplier_id', 'name code')
      .sort({ recorded_at: -1 })
      .limit(limit);
  }

  async getLatestPrices() {
    // Aggregate latest price per product
    const latestPrices = await ProductPrice.aggregate([
      { $sort: { recorded_at: -1 } },
      {
        $group: {
          _id: '$product_id',
          latest_price: { $first: '$price' },
          supplier_id: { $first: '$supplier_id' },
          recorded_at: { $first: '$recorded_at' },
          source: { $first: '$source' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'units',
          localField: 'product.unit_id',
          foreignField: '_id',
          as: 'product_unit'
        }
      },
      { $unwind: { path: '$product_unit', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplier_id',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } }
    ]);
    const productsWithoutPriceHistory = await Product.find({
      last_purchase_price: { $gt: 0 }
    })
      .populate('unit_id', 'name abbreviation')
      .populate('last_supplier_id', 'name code')
      .lean();
    const knownProductIds = new Set(latestPrices.map((entry) => entry._id.toString()));

    productsWithoutPriceHistory.forEach((product) => {
      if (knownProductIds.has(product._id.toString())) return;
      latestPrices.push({
        _id: product._id,
        latest_price: product.last_purchase_price,
        supplier_id: product.last_supplier_id?._id || product.last_supplier_id || null,
        supplier: product.last_supplier_id || null,
        product,
        product_unit: product.unit_id || null,
        recorded_at: null,
        source: 'product_master'
      });
    });

    return latestPrices;
  }
}

module.exports = new PriceService();
