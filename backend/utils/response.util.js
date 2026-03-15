/**
 * Sends a standardized success response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {Object|Array} [data] - Optional data payload
 */
const sendSuccess = (res, statusCode, message, data = null) => {
  const responseData = {
    success: true,
    message,
  };
  if (data !== null) {
    responseData.data = data;
  }
  return res.status(statusCode).json(responseData);
};

/**
 * Sends a standardized error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Internal application error code
 * @param {string} message - Error message describing what went wrong
 * @param {Object|Array} [details] - Detailed error information (e.g., validation errors)
 */
const sendError = (res, statusCode, code, message, details = null) => {
  const errorObj = {
    code,
    message,
  };
  if (details !== null) {
    errorObj.details = details;
  }
  
  return res.status(statusCode).json({
    success: false,
    error: errorObj
  });
};

module.exports = {
  sendSuccess,
  sendError
};
