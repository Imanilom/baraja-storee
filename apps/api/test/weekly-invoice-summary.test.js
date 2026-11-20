const assert = require('node:assert/strict');
const test = require('node:test');
const invoiceService = require('../src/modules/invoices/invoice.service');
const overheadService = require('../src/modules/overheads/overhead.service');
const invoiceController = require('../src/modules/invoices/invoice.controller');

test('weekly invoice summary total includes invoice amounts and overhead', async () => {
  const originalGetInvoicesForWeek = invoiceService.getInvoicesForWeek;
  const originalGetOverheadSummary = overheadService.getOverheadSummary;
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

  try {
    await invoiceController.weeklySummary({
      query: { startDate: '2026-11-14', endDate: '2026-11-20' }
    }, res);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, {
      invoice_count: 2,
      invoice_total: 2000,
      overhead_total: 250,
      total_amount: 2250
    });
  } finally {
    invoiceService.getInvoicesForWeek = originalGetInvoicesForWeek;
    overheadService.getOverheadSummary = originalGetOverheadSummary;
  }
});
