const ProductPrice = require('./product-price.model');

class PriceService {
  async getPriceHistoryByProduct(productId, limit = 20) {
    return ProductPrice.find({ product_id: productId })
      .populate('supplier_id', 'name code')
      .sort({ recorded_at: -1 })
      .limit(limit);
  }

  async getLatestPrices() {
    // Aggregate latest price per product
    return ProductPrice.aggregate([
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
          from: 'suppliers',
          localField: 'supplier_id',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } }
    ]);
  }
}

module.exports = new PriceService();

