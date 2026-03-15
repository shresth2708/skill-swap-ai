/**
 * Unit tests for EmailObserver.
 *
 * Mocks: Nodemailer transport.
 * Tests: SWAP_ACCEPTED sends correct email, unknown type is gracefully skipped.
 */

const EmailObserver = require('../observers/email.observer');

describe('EmailObserver', () => {
  let observer;
  let mockTransport;

  beforeEach(() => {
    mockTransport = {
      sendMail: jest.fn().mockResolvedValue({ messageId: '<test@test.com>' }),
    };
    observer = new EmailObserver(mockTransport);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return "email" as channel', () => {
    expect(observer.getChannel()).toBe('email');
  });

  describe('update — SWAP_ACCEPTED', () => {
    it('should call sendMail with correct subject for SWAP_ACCEPTED', async () => {
      const event = {
        userId: 'user-1',
        type: 'SWAP_ACCEPTED',
        title: 'Swap accepted',
        body: 'Your swap request was accepted!',
        payload: {
          userEmail: 'alice@example.com',
          actorName: 'Bob',
        },
        createdAt: new Date(),
      };

      await observer.update(event);

      expect(mockTransport.sendMail).toHaveBeenCalledTimes(1);
      const call = mockTransport.sendMail.mock.calls[0][0];
      expect(call.to).toBe('alice@example.com');
      expect(call.subject).toBe('Your swap request was accepted!');
      expect(call.html).toContain('Swap accepted');
    });
  });

  describe('update — SWAP_CREATED', () => {
    it('should include actor name in the subject', async () => {
      const event = {
        userId: 'user-2',
        type: 'SWAP_CREATED',
        title: 'New swap request',
        body: 'You have a new swap request from Alice',
        payload: {
          userEmail: 'bob@example.com',
          actorName: 'Alice',
        },
        createdAt: new Date(),
      };

      await observer.update(event);

      const call = mockTransport.sendMail.mock.calls[0][0];
      expect(call.subject).toContain('Alice');
    });
  });

  describe('update — unknown type', () => {
    it('should still send an email with generic subject for unknown type', async () => {
      const event = {
        userId: 'user-3',
        type: 'SOME_UNKNOWN_EVENT',
        title: 'Notification',
        body: 'Something happened',
        payload: {
          userEmail: 'charlie@example.com',
        },
        createdAt: new Date(),
      };

      await observer.update(event);

      const call = mockTransport.sendMail.mock.calls[0][0];
      expect(call.subject).toBe('SkillSwap notification');
    });
  });

  describe('update — missing email', () => {
    it('should not call sendMail when userEmail is missing', async () => {
      const event = {
        userId: 'user-4',
        type: 'SWAP_ACCEPTED',
        title: 'Swap accepted',
        body: 'Your swap request was accepted!',
        payload: {},
        createdAt: new Date(),
      };

      await observer.update(event);

      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('formatTemplate', () => {
    it('should return HTML string with inline styles', () => {
      const html = observer.formatTemplate({
        title: 'Test Title',
        body: 'Test body content',
      });

      expect(html).toContain('Test Title');
      expect(html).toContain('Test body content');
      expect(html).toContain('style=');
      expect(html).toContain('SkillSwap AI');
    });
  });
});
