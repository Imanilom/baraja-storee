const assert = require('node:assert/strict');
const coffeeInventoryService = require('../src/modules/integrations/coffee-inventory.service');

async function run() {
  const previousUrl = process.env.BARAJA_AMPHITHEATER_API_URL;
  const previousSecret = process.env.BARAJA_STORE_INTEGRATION_SECRET;
  const originalFetch = global.fetch;
  const requests = [];

  try {
    delete process.env.BARAJA_AMPHITHEATER_API_URL;
    delete process.env.BARAJA_STORE_INTEGRATION_SECRET;
    await assert.rejects(
      coffeeInventoryService.getCoffeeInventory(),
      (error) => error.statusCode === 503
    );

    process.env.BARAJA_AMPHITHEATER_API_URL = 'https://coffee.test/';
    process.env.BARAJA_STORE_INTEGRATION_SECRET = 'test-only-shared-secret';
    global.fetch = async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { menus: [] } })
      };
    };

    const inventory = await coffeeInventoryService.getCoffeeInventory();
    assert.deepEqual(inventory, { menus: [] });
    assert.equal(requests[0].url, 'https://coffee.test/api/integration/store/inventory');
    assert.equal(requests[0].options.headers.authorization, 'Bearer test-only-shared-secret');

    await coffeeInventoryService.createCoffeeRecipe({
      menuItemId: 'coffee-menu-id',
      baseIngredients: []
    });
    assert.equal(requests[1].options.method, 'POST');
    assert.deepEqual(JSON.parse(requests[1].options.body), {
      menuItemId: 'coffee-menu-id',
      baseIngredients: []
    });

    await coffeeInventoryService.updateCoffeeRecipe('recipe/1', { baseIngredients: [] });
    assert.equal(
      requests[2].url,
      'https://coffee.test/api/integration/store/recipes/recipe%2F1'
    );
    assert.equal(requests[2].options.method, 'PUT');

    await coffeeInventoryService.adjustCoffeeIngredientStock('coffee-product-id', {
      warehouseId: 'coffee-warehouse-id',
      actualStock: 12,
      handledBy: 'Test Admin',
      notes: 'Stock opname'
    });
    assert.equal(
      requests[3].url,
      'https://coffee.test/api/integration/store/ingredients/coffee-product-id/stock'
    );
    assert.equal(requests[3].options.method, 'PUT');

    await coffeeInventoryService.createCoffeeIngredient({
      sku: 'RAW-001',
      name: 'Coffee Beans',
      category: 'food',
      unit: 'gram'
    });
    assert.equal(requests[4].url, 'https://coffee.test/api/integration/store/ingredients');
    assert.equal(requests[4].options.method, 'POST');
    assert.deepEqual(JSON.parse(requests[4].options.body), {
      sku: 'RAW-001',
      name: 'Coffee Beans',
      category: 'food',
      unit: 'gram'
    });

    await coffeeInventoryService.updateCoffeeIngredient('product/1', {
      name: 'Arabica Beans'
    });
    assert.equal(
      requests[5].url,
      'https://coffee.test/api/integration/store/ingredients/product%2F1'
    );
    assert.equal(requests[5].options.method, 'PUT');

    await coffeeInventoryService.deleteCoffeeIngredient('product/1');
    assert.equal(
      requests[6].url,
      'https://coffee.test/api/integration/store/ingredients/product%2F1'
    );
    assert.equal(requests[6].options.method, 'DELETE');

    global.fetch = async () => ({
      ok: false,
      status: 409,
      json: async () => ({ success: false, message: 'Recipe conflict' })
    });
    await assert.rejects(
      coffeeInventoryService.createCoffeeRecipe({}),
      (error) => error.statusCode === 409 && error.message === 'Recipe conflict'
    );
  } finally {
    global.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.BARAJA_AMPHITHEATER_API_URL;
    else process.env.BARAJA_AMPHITHEATER_API_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.BARAJA_STORE_INTEGRATION_SECRET;
    else process.env.BARAJA_STORE_INTEGRATION_SECRET = previousSecret;
  }
}

run()
  .then(() => console.log('Coffee inventory proxy checks passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
