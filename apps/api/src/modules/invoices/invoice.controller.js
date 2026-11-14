const invoiceService = require('./invoice.service');
const invoicePdfService = require('./invoice-pdf.service');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response');

class InvoiceController {
  async list(req, res) {
    try {
      const { items, total, page, limit } = await invoiceService.getAllInvoices(req.query);
      return sendPaginated(res, 'Invoices retrieved', items, total, page, limit);
    } catch (error) {
      return sendError(res, 'Failed to fetch invoices', error.message, 500);
    }
  }

  async getById(req, res) {
    try {
      const invoice = await invoiceService.getInvoiceById(req.params.id);
      if (!invoice) {
        return sendError(res, 'Invoice not found', null, 404);
      }
      return sendSuccess(res, 'Invoice details', invoice);
    } catch (error) {
      return sendError(res, 'Failed to fetch invoice', error.message, 500);
    }
  }

  async generate(req, res) {
    try {
      const invoices = await invoiceService.generateInvoicesFromMarketlist(req.params.marketlistId, req.body, req.user);
      return sendSuccess(res, 'Invoices generated successfully', invoices, 201);
    } catch (error) {
      return sendError(res, 'Failed to generate invoice', error.message, 400);
    }
  }

  async regenerateAll(req, res) {
    try {
      const invoices = await invoiceService.regenerateAllInvoices(req.user);
      return sendSuccess(res, 'All eligible invoices generated or refreshed', invoices);
    } catch (error) {
      return sendError(res, 'Failed to generate all invoices', error.message, 400);
    }
  }

  async verify(req, res) {
    try {
      const invoice = await invoiceService.verifyInvoice(req.params.id, req.user);
      return sendSuccess(res, 'Invoice verified successfully', invoice);
    } catch (error) {
      return sendError(res, 'Failed to verify invoice', error.message, 400);
    }
  }

  async updateItems(req, res) {
    try {
      const invoice = await invoiceService.updateInvoiceItems(req.params.id, req.body, req.user);
      return sendSuccess(res, 'Invoice items updated successfully', invoice);
    } catch (error) {
      return sendError(res, 'Failed to update invoice items', error.message, 400);
    }
  }

  async refreshPrices(req, res) {
    try {
      const invoice = await invoiceService.refreshInvoicePrices(req.params.id, req.user);
      return sendSuccess(res, 'Invoice prices refreshed successfully', invoice);
    } catch (error) {
      return sendError(res, 'Failed to refresh invoice prices', error.message, 400);
    }
  }

  async downloadPdf(req, res) {
    try {
      const invoice = await invoiceService.getInvoiceById(req.params.id);
      if (!invoice) {
        return sendError(res, 'Invoice not found', null, 404);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number.replace(/\//g, '-')}.pdf"`);

      invoicePdfService.generateInvoicePdf(invoice, res);
    } catch (error) {
      return sendError(res, 'Failed to generate PDF', error.message, 500);
    }
  }

  async downloadWeeklyPdf(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const invoices = await invoiceService.getInvoicesForWeek(startDate, endDate);
      if (invoices.length === 0) {
        return sendError(res, 'No invoices found for the selected week', null, 404);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="invoice-mingguan-${startDate}-${endDate}.pdf"`
      );
      invoicePdfService.generateInvoicesPdf(invoices, res, { startDate, endDate });
    } catch (error) {
      return sendError(
        res,
        'Failed to generate weekly PDF',
        error.message,
        error.statusCode || 500
      );
    }
  }

  async weeklySummary(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const invoices = await invoiceService.getInvoicesForWeek(startDate, endDate);
      return sendSuccess(res, 'Weekly invoice summary retrieved', {
        invoice_count: invoices.length,
        total_amount: invoices.reduce((total, invoice) => total + (Number(invoice.grand_total) || 0), 0)
      });
    } catch (error) {
      return sendError(
        res,
        'Failed to retrieve weekly invoice summary',
        error.message,
        error.statusCode || 500
      );
    }
  }
}

module.exports = new InvoiceController();
