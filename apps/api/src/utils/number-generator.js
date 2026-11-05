/**
 * Generates structured document numbers
 */

function pad(num, size = 4) {
  let s = num + '';
  while (s.length < size) s = '0' + s;
  return s;
}

const generateMarketlistNumber = (seq) => {
  const year = new Date().getFullYear();
  return `ML-${year}-${pad(seq, 4)}`;
};

const generateGoodsReceiptNumber = (seq) => {
  const year = new Date().getFullYear();
  return `GR-${year}-${pad(seq, 4)}`;
};

const generateInvoiceNumber = (seq) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `INV/${year}/${month}/${pad(seq, 4)}`;
};

const generatePurchaseNumber = (seq) => {
  const year = new Date().getFullYear();
  return `PO-${year}-${pad(seq, 4)}`;
};

module.exports = {
  generateMarketlistNumber,
  generateGoodsReceiptNumber,
  generateInvoiceNumber,
  generatePurchaseNumber
};

