const productService = require('./product.service');
const { sendSuccess, sendError } = require('../../utils/response');

class ProductController {
  async list(req, res) {
    try {
      const products = await productService.getAllProducts(req.query);
      return sendSuccess(res, 'Products retrieved', products);
    } catch (error) {
      return sendError(res, 'Failed to fetch products', error.message, 500);
    }
  }

  async getById(req, res) {
    try {
      const product = await productService.getProductById(req.params.id);
      if (!product) {
        return sendError(res, 'Product not found', null, 404);
      }
      return sendSuccess(res, 'Product details', product);
    } catch (error) {
      return sendError(res, 'Failed to fetch product', error.message, 500);
    }
  }

  async create(req, res) {
    try {
      const product = await productService.createProduct(req.body);
      return sendSuccess(res, 'Product created successfully', product, 201);
    } catch (error) {
      return sendError(res, 'Failed to create product', error.message, 400);
    }
  }

  async update(req, res) {
    try {
      const product = await productService.updateProduct(req.params.id, req.body);
      if (!product) {
        return sendError(res, 'Product not found', null, 404);
      }
      return sendSuccess(res, 'Product updated successfully', product);
    } catch (error) {
      return sendError(res, 'Failed to update product', error.message, 400);
    }
  }

  async delete(req, res) {
    try {
      const product = await productService.deleteProduct(req.params.id);
      if (!product) {
        return sendError(res, 'Product not found', null, 404);
      }
      return sendSuccess(res, 'Product deactivated successfully', product);
    } catch (error) {
      return sendError(res, 'Failed to deactivate product', error.message, 400);
    }
  }

  async listCategories(req, res) {
    try {
      const categories = await productService.getCategories();
      return sendSuccess(res, 'Categories retrieved', categories);
    } catch (error) {
      return sendError(res, 'Failed to fetch categories', error.message, 500);
    }
  }

  async createCategory(req, res) {
    try {
      const category = await productService.createCategory(req.body);
      return sendSuccess(res, 'Category created', category, 201);
    } catch (error) {
      return sendError(res, 'Failed to create category', error.message, 400);
    }
  }

  async listUnits(req, res) {
    try {
      const units = await productService.getUnits();
      return sendSuccess(res, 'Units retrieved', units);
    } catch (error) {
      return sendError(res, 'Failed to fetch units', error.message, 500);
    }
  }

  async createUnit(req, res) {
    try {
      const unit = await productService.createUnit(req.body);
      return sendSuccess(res, 'Unit created', unit, 201);
    } catch (error) {
      return sendError(res, 'Failed to create unit', error.message, 400);
    }
  }
}

module.exports = new ProductController();

