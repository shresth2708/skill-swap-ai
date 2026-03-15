const { validateBody } = require('../middlewares/validate.middleware');
const { z } = require('zod');
const { sendError } = require('../utils/response.util');

jest.mock('../utils/response.util', () => ({
  sendError: jest.fn(),
}));

describe('validate.middleware', () => {
  let req, res, next;
  const schema = z.object({
    name: z.string(),
    age: z.number().min(18),
  });

  beforeEach(() => {
    req = { body: {} };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should call next if validation passes', () => {
    req.body = { name: 'Test', age: 20 };
    const middleware = validateBody(schema);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Test', age: 20 });
  });

  it('should call sendError if validation fails (ZodError)', () => {
    const middleware = validateBody(schema);
    middleware({ body: { name: 'Test', age: 10 } }, res, next);
    
    expect(sendError).toHaveBeenCalled();
    const call = sendError.mock.calls[0];
    expect(call[1]).toBe(400);
    expect(call[2]).toBe('VALIDATION_ERROR');
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with error for non-Zod errors', () => {
    const brokenSchema = {
      parse: () => {
        throw new Error('Unexpected');
      },
    };
    const middleware = validateBody(brokenSchema);
    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Unexpected');
  });
});
