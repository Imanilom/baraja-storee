const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDate = (value, label) => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${label} transaksi tidak valid.`);
  }

  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new Error(`${label} transaksi tidak valid.`);
    }
  }

  return parsed;
};

const buildDateRangeFilter = (startDate, endDate) => {
  const filter = {};

  if (startDate) {
    filter.$gte = parseDate(startDate, 'Tanggal awal');
  }

  if (endDate) {
    const parsedEnd = parseDate(endDate, 'Tanggal akhir');
    if (typeof endDate === 'string' && DATE_ONLY_PATTERN.test(endDate)) {
      filter.$lt = new Date(parsedEnd.getTime() + 86400000);
    } else {
      filter.$lte = parsedEnd;
    }
  }

  return filter;
};

module.exports = { buildDateRangeFilter };
