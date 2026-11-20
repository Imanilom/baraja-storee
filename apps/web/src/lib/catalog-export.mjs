const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE');
};

export function createLatestPricesExportRows(prices) {
  if (!Array.isArray(prices)) {
    throw new TypeError('Latest prices must be an array.');
  }

  return [
    ['Nama Produk', 'SKU', 'Harga Terbaru', 'Satuan', 'Supplier', 'Tanggal', 'Sumber'],
    ...prices.map((entry) => [
      entry.product?.name || 'Produk',
      entry.product?.sku || '',
      Number(entry.latest_price) || 0,
      entry.product_unit?.abbreviation || entry.product_unit?.name || 'unit',
      entry.supplier?.name || '',
      formatDate(entry.recorded_at),
      entry.source === 'purchase'
        ? 'Pembelian'
        : entry.source === 'marketlist'
          ? 'Marketlist'
          : entry.source || ''
    ])
  ];
}

export function createProductsExportRows(products) {
  if (!Array.isArray(products)) {
    throw new TypeError('Products must be an array.');
  }

  return [
    ['Nama Produk', 'SKU', 'Tipe', 'Kategori', 'Satuan', 'Harga Beli Terakhir', 'Supplier Terakhir', 'Status'],
    ...products.map((product) => [
      product.name || '',
      product.sku || '',
      product.item_type === 'perishable' ? 'Perishable' : 'Groceries',
      product.category_id?.name || 'Umum',
      product.unit_id?.name || 'Pcs',
      Number(product.last_purchase_price) || 0,
      product.last_supplier_id?.name || '',
      product.is_active === false ? 'Nonaktif' : 'Aktif'
    ])
  ];
}
