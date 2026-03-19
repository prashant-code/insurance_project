/**
 * Security utilities focusing on Data Masking and Anonymization.
 * Used to irreversibly protect customer PII in the database when the exact raw value 
 * is not functionally required by the system, saving AES encryption overhead.
 */

export const maskString = (str) => {
  if (!str) return null;
  if (str.length <= 2) return '*'.repeat(str.length);
  // Keep first char, mask the rest
  return str.charAt(0) + '*'.repeat(str.length - 1);
};

export const maskPhone = (phone) => {
  if (!phone) return null;
  const str = String(phone);
  if (str.length <= 4) return '*'.repeat(str.length);
  // Keep last 4 digits
  return '*'.repeat(str.length - 4) + str.slice(-4);
};

export const maskDate = (dateStr) => {
  if (!dateStr) return null;
  // E.g. 1990-05-15 -> 1990-**-**
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-**-**`;
  }
  return '****-**-**';
};
