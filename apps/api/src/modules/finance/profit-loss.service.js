const Invoice = require('../invoices/invoice.model');
const Marketlist = require('../marketlists/marketlist.model');
const Overhead = require('../overheads/overhead.model');
const oauth2ClientService = require('./oauth2-client.service');

const getPeriodRange = (period, startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date(start);

  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) start.setHours(0, 0, 0, 0);
  if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) end.setHours(23, 59, 59, 999);

  if (!startDate || !endDate) {
    if (period === 'daily') {
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setHours(23, 59, 59, 999);
    } else if (period === 'weekly') {
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'yearly') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    }
  }

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Rentang tanggal laba rugi tidak valid.');
  }

  return { start, end };
};

class ProfitLossService {
  async calculateProfitLoss(query = {}) {
    const { period = 'monthly', startDate, endDate, operating_expense } = query;
    const range = getPeriodRange(period, startDate, endDate);
    const dateFilter = { $gte: range.start, $lte: range.end };

    // 1. Fetch sales & revenue from external API via OAuth 2
    const salesReport = await oauth2ClientService.fetchExternalSalesData(
      period,
      range.start.toISOString(),
      range.end.toISOString()
    );
    const totalRevenue = salesReport.total_sales || 0;

    // 2. Fetch HPP from purchasing invoices
    const invoiceFilter = {
      status: { $in: ['generated', 'verified', 'partially_paid', 'paid'] },
      invoice_date: dateFilter
    };

    const invoices = await Invoice.find(invoiceFilter).populate('supplier_id', 'name code');
    let totalPurchasingHPP = 0;
    const hppBySupplier = {};

    invoices.forEach((inv) => {
      totalPurchasingHPP += inv.grand_total || 0;
      const suppName = inv.supplier_id?.name || 'Lain-lain';
      hppBySupplier[suppName] = (hppBySupplier[suppName] || 0) + inv.grand_total;
    });

    // If no invoices exist yet in fresh system, take approved marketlist estimated amounts
    if (totalPurchasingHPP === 0) {
      const approvedMarketlists = await Marketlist.find({
        status: { $in: ['approved', 'partial_rejection', 'in_progress', 'partially_received', 'received', 'completed'] },
        date: dateFilter
      });
      approvedMarketlists.forEach((ml) => {
        totalPurchasingHPP += ml.totals?.estimated_amount || 0;
      });
    }

    // 3. Fetch Real Overhead Expenses from database
    const overheadFilter = { expense_date: dateFilter };

    const recordedOverheads = await Overhead.find(overheadFilter);
    let totalRealOverhead = 0;
    const overheadByCategory = {};

    recordedOverheads.forEach((item) => {
      totalRealOverhead += item.amount || 0;
      const cat = item.category || 'lain_lain';
      overheadByCategory[cat] = (overheadByCategory[cat] || 0) + item.amount;
    });

    // Use the adjustable expense when sent; otherwise use recorded overhead.
    let opExpenses = totalRealOverhead;
    let isRealData = totalRealOverhead > 0;
    if (operating_expense !== undefined && operating_expense !== null && operating_expense !== '') {
      opExpenses = Number(operating_expense);
      isRealData = false;
    }

    // 4. Profit Calculations
    const grossProfit = totalRevenue - totalPurchasingHPP;
    const grossMarginPercent = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0;

    const netProfit = grossProfit - opExpenses;
    const netMarginPercent = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0;

    return {
      period,
      currency: 'IDR',
      oauth2_info: {
        source: salesReport.source || 'External Sales API via OAuth 2',
        authenticated_via: 'OAuth 2.0 Bearer Token'
      },
      summary: {
        total_revenue: totalRevenue,
        total_cogs: totalPurchasingHPP, // HPP (Harga Pokok Penjualan)
        gross_profit: grossProfit,
        gross_margin_percentage: grossMarginPercent,
        operating_expenses: opExpenses,
        is_real_overhead: isRealData,
        total_recorded_overhead: totalRealOverhead,
        net_profit: netProfit,
        net_margin_percentage: netMarginPercent
      },
      sales_breakdown: salesReport.sales_breakdown || [],
      daily_trends: salesReport.daily_trends || [],
      cogs_breakdown: Object.entries(hppBySupplier).map(([supplier, amount]) => ({
        supplier,
        amount
      })),
      overhead_breakdown: Object.entries(overheadByCategory).map(([category, amount]) => ({
        category,
        amount
      })),
      calculated_at: new Date().toISOString()
    };
  }
}

module.exports = new ProfitLossService();
