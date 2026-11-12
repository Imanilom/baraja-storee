const Product = require('./product.model');
const Category = require('./category.model');
const Unit = require('./unit.model');

class ProductService {
  async getAllProducts(query = {}) {
    const filter = {};
    if (query.status === 'inactive') {
      filter.is_active = false;
    } else if (query.status === 'active' || (!query.status && query.include_inactive !== 'true')) {
      filter.is_active = true;
    }

    if (query.category_id) filter.category_id = query.category_id;
    if (query.item_type) filter.item_type = query.item_type;
    if (query.search) {
      const search = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(filter)
      .populate('category_id', 'name type')
      .populate('unit_id', 'name abbreviation')
      .populate('last_supplier_id', 'name code')
      .sort({ name: 1 })
      .lean();

    const ProductPrice = require('../prices/product-price.model');
    const MarketlistItem = require('../marketlists/marketlist-item.model');

    return Promise.all(
      products.map(async (p) => {
        if (!p.last_purchase_price || !p.last_supplier_id) {
          const latestPrice = await ProductPrice.findOne({ product_id: p._id })
            .sort({ recorded_at: -1 })
            .lean();
          if (latestPrice) {
            p.last_purchase_price = p.last_purchase_price || latestPrice.price;
            p.last_supplier_id = p.last_supplier_id || latestPrice.supplier_id;
          } else {
            const mlItem = await MarketlistItem.findOne({
              product_id: p._id,
              unit_price: { $gt: 0 }
            })
              .sort({ createdAt: -1 })
              .lean();
            if (mlItem) {
              p.last_purchase_price = p.last_purchase_price || mlItem.unit_price;
              p.last_supplier_id = p.last_supplier_id || mlItem.supplier_id;
            }
          }
        }
        return p;
      })
    );
  }

  async getProductById(id) {
    return Product.findById(id)
      .populate('category_id', 'name')
      .populate('unit_id', 'name abbreviation')
      .populate('last_supplier_id', 'name code');
  }

  async createProduct(data) {
    if (!data.unit_id) {
      let defaultUnit = await Unit.findOne({ is_active: true });
      if (!defaultUnit) {
        defaultUnit = await Unit.create({ name: 'Pieces', abbreviation: 'pcs', is_active: true });
      }
      data.unit_id = defaultUnit._id;
    }
    if (!data.sku) {
      const count = await Product.countDocuments();
      data.sku = `PRD-${Date.now().toString().slice(-4)}-${count + 1}`;
    }
    if (data.category_id === '') delete data.category_id;
    const product = new Product(data);
    return product.save();
  }

  async updateProduct(id, data) {
    return Product.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteProduct(id) {
    return Product.findByIdAndUpdate(id, { is_active: false }, { new: true });
  }

  // Categories & Units helpers
  async getCategories() {
    return Category.find({ is_active: true }).sort({ name: 1 });
  }

  async createCategory(data) {
    const cat = new Category(data);
    return cat.save();
  }

  async getUnits() {
    return Unit.find({ is_active: true }).sort({ name: 1 });
  }

  async createUnit(data) {
    const unit = new Unit(data);
    return unit.save();
  }
}

module.exports = new ProductService();
