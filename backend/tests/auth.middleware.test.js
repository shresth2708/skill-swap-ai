const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { verifyToken } = require('../utils/jwt.util');
const { sendError } = require('../utils/response.util');

jest.mock('../utils/jwt.util');
jest.mock('../utils/response.util', () => ({
  sendError: jest.fn(),
}));

describe('auth.middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should call next if token is valid', () => {
    req.headers.authorization = 'Bearer valid-token';
    verifyToken.mockReturnValue({ id: 'user-1' });
    
    verifyAccessToken(req, res, next);
    
    expect(verifyToken).toHaveBeenCalledWith('valid-token', false);
    expect(req.user).toEqual({ id: 'user-1' });
    expect(next).toHaveBeenCalled();
  });

  it('should return 401 if no auth header', () => {
    verifyAccessToken(req, res, next);
    expect(sendError).toHaveBeenCalledWith(res, 401, 'UNAUTHORIZED', expect.any(String));
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if invalid format', () => {
    req.headers.authorization = 'InvalidToken';
    verifyAccessToken(req, res, next);
    expect(sendError).toHaveBeenCalledWith(res, 401, 'UNAUTHORIZED', expect.any(String));
  });

  it('should return 401 if token is invalid/expired', () => {
    req.headers.authorization = 'Bearer invalid';
    verifyToken.mockImplementation(() => {
      throw new Error('Expired');
    });
    
    verifyAccessToken(req, res, next);
    
    expect(sendError).toHaveBeenCalledWith(
      res, 
      401, 
      'UNAUTHORIZED', 
      'Token is invalid or expired', 
      'Expired'
    );
  });
});
