export const parseDateOnlyLocal = (value: string): Date => {
  if (!value) return new Date(NaN);

  // Avoid UTC parsing for YYYY-MM-DD, which can shift one day in some timezones.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
};

