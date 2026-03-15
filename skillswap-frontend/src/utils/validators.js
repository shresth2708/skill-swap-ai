const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (email) => {
  if (!email?.trim()) return 'Email is required';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address';
  return '';
};

export const getPasswordStrength = (password = '') => {
  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  score += checks.length ? 1 : 0;
  score += checks.lowercase ? 1 : 0;
  score += checks.uppercase ? 1 : 0;
  score += checks.number ? 1 : 0;
  score += checks.special ? 1 : 0;

  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const label = labels[Math.min(score, labels.length - 1)];

  return { score, label, checks };
};

export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  return '';
};

export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return '';
};

export const validateLogin = ({ email, password }) => ({
  email: validateEmail(email),
  password: validatePassword(password),
});

export const validateRegister = ({ name, email, password, confirmPassword }) => ({
  name: name?.trim() ? '' : 'Name is required',
  email: validateEmail(email),
  password: validatePassword(password),
  confirmPassword: validateConfirmPassword(password, confirmPassword),
});
