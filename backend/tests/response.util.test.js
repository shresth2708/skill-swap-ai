const { sendSuccess, sendError } = require('../utils/response.util');

describe('response.util', () => {
  let res;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('sendSuccess', () => {
    it('should send success without data', () => {
      sendSuccess(res, 200, 'OK');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'OK',
      });
    });

    it('should send success with data', () => {
      sendSuccess(res, 201, 'Created', { id: 1 });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Created',
        data: { id: 1 },
      });
    });
  });

  describe('sendError', () => {
    it('should send error without details', () => {
      sendError(res, 404, 'NOT_FOUND', 'Missing');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Missing',
        },
      });
    });

    it('should send error with details', () => {
      sendError(res, 400, 'VALIDATION_FAIL', 'Bad', ['err1']);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_FAIL',
          message: 'Bad',
          details: ['err1'],
        },
      });
    });
  });
});
