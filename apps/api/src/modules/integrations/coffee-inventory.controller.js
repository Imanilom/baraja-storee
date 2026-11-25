const coffeeInventoryService = require('./coffee-inventory.service');

const respond = (operation, successStatus = 200) => async (req, res) => {
  try {
    const data = await operation(req);
    return res.status(successStatus).json({ success: true, data });
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      success: false,
      message: error.message || 'Integrasi stok Baraja Coffee gagal.'
    });
  }
};

module.exports = {
  getInventory: respond(() => coffeeInventoryService.getCoffeeInventory()),
  getRecipes: respond(() => coffeeInventoryService.getCoffeeRecipes()),
  createIngredient: respond(
    (req) => coffeeInventoryService.createCoffeeIngredient(req.body || {}),
    201
  ),
  updateIngredient: respond(
    (req) => coffeeInventoryService.updateCoffeeIngredient(req.params.productId, req.body || {})
  ),
  deleteIngredient: respond(
    (req) => coffeeInventoryService.deleteCoffeeIngredient(req.params.productId)
  ),
  createRecipe: respond(
    (req) => coffeeInventoryService.createCoffeeRecipe(req.body || {}),
    201
  ),
  updateRecipe: respond(
    (req) => coffeeInventoryService.updateCoffeeRecipe(req.params.recipeId, req.body || {})
  ),
  adjustIngredientStock: respond(
    (req) => coffeeInventoryService.adjustCoffeeIngredientStock(
      req.params.productId,
      req.body || {}
    )
  )
};
