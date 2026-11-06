const sendSuccess = (res, message, data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const sendError = (res, message, error = null, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: error ? (error.message || error) : undefined
  });
};

const sendPaginated = (res, message, items, total, page = 1, limit = 10) => {
  return res.status(200).json({
    success: true,
    message,
    items,
    total,
    data: {
      items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    }
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendPaginated
};

