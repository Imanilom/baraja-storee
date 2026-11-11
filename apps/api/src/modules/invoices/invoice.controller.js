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
}

module.exports = new InvoiceController();
