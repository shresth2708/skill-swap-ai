const { isAdmin } = require('../middlewares/admin-role.middleware');
const { sendError } = require('../utils/response.util');

jest.mock('../utils/response.util', () => ({
  sendError: jest.fn(),
}));

describe('admin-role.middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: {} };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should call next if user is admin', () => {
    req.user.role = 'admin'; // lowercase admin
    isAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if user is not admin', () => {
    req.user.role = 'USER';
    isAdmin(req, res, next);
    expect(sendError).toHaveBeenCalledWith(
      res, 
      403, 
      'Forbidden: Admin access required', 
      'FORBIDDEN_ACCESS'
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if user has no role', () => {
    isAdmin(req, res, next);
    expect(sendError).toHaveBeenCalledWith(
      res, 
      403, 
      'Forbidden: Admin access required', 
      'FORBIDDEN_ACCESS'
    );
  });
});
