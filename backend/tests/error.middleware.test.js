const errorHandler = require('../middlewares/error.middleware');
const { sendError } = require('../utils/response.util');

jest.mock('../utils/response.util', () => ({
  sendError: jest.fn(),
}));

describe('error.middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should format error with defaults', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = new Error('Test error');
    errorHandler(err, req, res, next);
    expect(sendError).toHaveBeenCalledWith(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'Test error',
      expect.any(String)
    );
    process.env.NODE_ENV = prevEnv;
  });

  it('should use custom status and error code', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = new Error('Custom error');
    err.statusCode = 400;
    err.errorCode = 'BAD_REQUEST';
    errorHandler(err, req, res, next);
    expect(sendError).toHaveBeenCalledWith(
      res,
      400,
      'BAD_REQUEST',
      'Custom error',
      expect.any(String)
    );
    process.env.NODE_ENV = prevEnv;
  });

  it('should handle missing error message', () => {
    const err = {};
    errorHandler(err, req, res, next);
    expect(sendError).toHaveBeenCalledWith(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
      null
    );
  });
});
