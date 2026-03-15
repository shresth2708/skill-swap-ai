const { sendError } = require('../utils/response.util');

jest.mock('../utils/response.util', () => ({
  sendError: jest.fn(),
}));

describe('rate-limiter.middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should have a handler that calls sendError', () => {
    // Use isolateModules to ensure the middleware gets a fresh mock of express-rate-limit
    jest.isolateModules(() => {
      const mockRateLimit = jest.fn((options) => {
        const middleware = (req, res, next) => next();
        middleware.options = options;
        return middleware;
      });
      jest.doMock('express-rate-limit', () => mockRateLimit);

      // Require the middleware inside this isolated scope
      require('../middlewares/rate-limiter.middleware');
      
      const config = mockRateLimit.mock.calls[0][0];
      const options = { statusCode: 429, message: 'Too many requests' };
      config.handler(req, res, next, options);
      
      expect(sendError).toHaveBeenCalledWith(res, 429, 'TOO_MANY_REQUESTS', 'Too many requests');
    });
  });
});
