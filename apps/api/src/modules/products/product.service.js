const Product = require('./product.model');
const Category = require('./category.model');
const Unit = require('./unit.model');

class ProductService {
  async getAllProducts(query = {}) {
    const filter = { is_active: true };
    if (query.category_id) filter.category_id = query.category_id;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { sku: { $regex: query.search, $options: 'i' } }
      ];
    }

    return Product.find(filter)
      .populate('category_id', 'name')
      .populate('unit_id', 'name abbreviation')
      .sort({ name: 1 });
  }

  async getProductById(id) {
    return Product.findById(id)
      .populate('category_id', 'name')
      .populate('unit_id', 'name abbreviation');
  }

  async createProduct(data) {
    const product = new Product(data);
    return product.save();
  }

  async updateProduct(id, data) {
    return Product.findByIdAndUpdate(id, data, { new: true });
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

