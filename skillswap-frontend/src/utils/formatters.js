import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

export const formatDateTime = (value, pattern = 'PP p') => {
  if (!value) return '—';

  const date = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(date)) return '—';

  return format(date, pattern);
};

export const formatRelativeTime = (value) => {
  if (!value) return '—';

  const date = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(date)) return '—';

  return formatDistanceToNow(date, { addSuffix: true });
};

export const formatCount = (value) => {
  const count = Number(value ?? 0);
  return new Intl.NumberFormat('en-US').format(Number.isNaN(count) ? 0 : count);
};

export const formatDuration = (minutes = 0) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) {
    return `${remainingMinutes}m`;
  }

  if (!remainingMinutes) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
};

export const truncateText = (value = '', maxLength = 120) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
};

export const capitalize = (value = '') =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '';
