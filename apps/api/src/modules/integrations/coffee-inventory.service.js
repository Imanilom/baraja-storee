const upstreamError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

async function requestCoffee(path, { method = 'GET', body } = {}) {
  const baseUrl = process.env.BARAJA_AMPHITHEATER_API_URL;
  const secret = process.env.BARAJA_STORE_INTEGRATION_SECRET;
  if (!baseUrl || !secret) {
    throw upstreamError(503, 'Integrasi stok Baraja Coffee belum dikonfigurasi.');
  }

  let response;
  try {
    response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/api/integration/store/${path}`,
      {
        method,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${secret}`,
          ...(body ? { 'content-type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10000)
      }
    );
  } catch (error) {
    throw upstreamError(502, `Tidak dapat menghubungi Baraja Coffee: ${error.message}`);
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw upstreamError(502, `Baraja Coffee mengirim respons yang tidak valid: ${error.message}`);
  }

  if (!response.ok) {
    const statusCode = response.status >= 400 && response.status < 500
      ? response.status
      : 502;
    throw upstreamError(
      statusCode,
      result?.message || `Permintaan ke Baraja Coffee gagal (HTTP ${response.status}).`
    );
  }
  if (!result || result.success === false || result.data === undefined) {
    throw upstreamError(502, 'Baraja Coffee tidak mengembalikan data yang diharapkan.');
  }
  return result.data;
}

async function getCoffeeInventory() {
  return requestCoffee('inventory');
}

async function getCoffeeRecipes() {
  return requestCoffee('recipes');
}

async function createCoffeeRecipe(body) {
  return requestCoffee('recipes', { method: 'POST', body });
}

async function updateCoffeeRecipe(recipeId, body) {
  return requestCoffee(`recipes/${encodeURIComponent(recipeId)}`, {
    method: 'PUT',
    body
  });
}

module.exports = {
  getCoffeeInventory,
  getCoffeeRecipes,
  createCoffeeRecipe,
  updateCoffeeRecipe
};
