const assert = require('node:assert/strict');
const test = require('node:test');
const invoiceService = require('../src/modules/invoices/invoice.service');
const invoicePdfService = require('../src/modules/invoices/invoice-pdf.service');
const overheadService = require('../src/modules/overheads/overhead.service');
const purchaseService = require('../src/modules/purchases/purchase.service');
const invoiceController = require('../src/modules/invoices/invoice.controller');

test('weekly invoice summary uses purchases plus overhead and reports invoice variance', async () => {
  const originalGetInvoicesForWeek = invoiceService.getInvoicesForWeek;
  const originalGetOverheadSummary = overheadService.getOverheadSummary;
  const originalGetPurchases = purchaseService.getPurchases;
  let response;
  const res = {
    status(statusCode) {
      response = { statusCode };
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    }
  };

  invoiceService.getInvoicesForWeek = async () => [
    { grand_total: 1200 },
    { grand_total: 800 }
  ];
  overheadService.getOverheadSummary = async () => ({ total_expense: 250 });
  purchaseService.getPurchases = async () => ({ total_amount: 2250 });

  try {
    await invoiceController.weeklySummary({
      query: { startDate: '2026-11-14', endDate: '2026-11-20' }
    }, res);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, {
      invoice_count: 2,
      invoice_total: 2000,
      purchase_total: 2250,
      invoice_difference: 250,
      overhead_total: 250,
      total_amount: 2500
    });
  } finally {
    invoiceService.getInvoicesForWeek = originalGetInvoicesForWeek;
    overheadService.getOverheadSummary = originalGetOverheadSummary;
    purchaseService.getPurchases = originalGetPurchases;
  }
});

test('weekly invoice PDF receives transaction purchases and overhead totals', async () => {
  const originalGetInvoicesForWeek = invoiceService.getInvoicesForWeek;
  const originalGetOverheadSummary = overheadService.getOverheadSummary;
  const originalGetPurchases = purchaseService.getPurchases;
  const originalGenerateInvoicesPdf = invoicePdfService.generateInvoicesPdf;
  let pdfArguments;

  invoiceService.getInvoicesForWeek = async () => [{ grand_total: 2000 }];
  overheadService.getOverheadSummary = async () => ({ total_expense: 250 });
  purchaseService.getPurchases = async () => ({ total_amount: 2250 });
  invoicePdfService.generateInvoicesPdf = (...args) => {
    pdfArguments = args;
  };

  try {
    await invoiceController.downloadWeeklyPdf({
      query: { startDate: '2026-11-14', endDate: '2026-11-20' }
    }, { setHeader() {} });

    assert.equal(pdfArguments[3], 250);
    assert.equal(pdfArguments[4], 2250);
  } finally {
    invoiceService.getInvoicesForWeek = originalGetInvoicesForWeek;
    overheadService.getOverheadSummary = originalGetOverheadSummary;
    purchaseService.getPurchases = originalGetPurchases;
    invoicePdfService.generateInvoicesPdf = originalGenerateInvoicesPdf;
  }
});
