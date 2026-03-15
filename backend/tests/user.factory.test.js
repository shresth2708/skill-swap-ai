const UserFactory = require('../factories/user.factory');

describe('UserFactory', () => {
  const dto = { email: 'test@example.com', displayName: 'Test User' };
  const hashedPassword = 'hashed_password';

  describe('createRegularUser', () => {
    it('should create a regular user payload', () => {
      const payload = UserFactory.createRegularUser(dto, hashedPassword);
      expect(payload.email).toBe(dto.email);
      expect(payload.passwordHash).toBe(hashedPassword);
      expect(payload.isActive).toBe(true);
      expect(payload.isVerified).toBe(false);
      expect(payload.profile.create.displayName).toBe(dto.displayName);
    });

    it('should use email prefix as default displayName if not provided', () => {
      const payload = UserFactory.createRegularUser({ email: 'bob@test.com' }, hashedPassword);
      expect(payload.profile.create.displayName).toBe('bob');
    });
  });

  describe('createAdminUser', () => {
    it('should create an admin user payload', () => {
      const payload = UserFactory.createAdminUser(dto, hashedPassword);
      expect(payload.isVerified).toBe(true);
      expect(payload.profile.create.displayName).toBe(dto.displayName);
    });

    it('should default to "Admin" displayName if not provided', () => {
      const payload = UserFactory.createAdminUser({ email: 'admin@test.com' }, hashedPassword);
      expect(payload.profile.create.displayName).toBe('Admin');
    });
  });

  describe('createGuestUser', () => {
    it('should create a guest user payload', () => {
      const payload = UserFactory.createGuestUser();
      expect(payload.email).toMatch(/guest_.*@guest.skillswap.local/);
      expect(payload.passwordHash).toBe('none');
      expect(payload.profile.create.displayName).toBe('Guest User');
    });
  });

  describe('fromOAuth', () => {
    it('should create a user from OAuth data', () => {
      const tokenData = { email: 'oauth@gmail.com', name: 'OAuth User', picture: 'pic.jpg' };
      const payload = UserFactory.fromOAuth('google', tokenData);
      expect(payload.email).toBe(tokenData.email);
      expect(payload.passwordHash).toBe('oauth_google');
      expect(payload.profile.create.displayName).toBe(tokenData.name);
      expect(payload.profile.create.avatarUrl).toBe(tokenData.picture);
    });
  });
});
