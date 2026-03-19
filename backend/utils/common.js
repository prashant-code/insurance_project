import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // Must be 32 bytes for AES-256
const IV_LENGTH = 16;

export const encryptPII = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decryptPII = (encryptedText) => {
  if (!encryptedText) return null;
  const parts = encryptedText.split(':');
  if (parts.length !== 3) return encryptedText; // Not in expected format
  
  const [iv, authTag, encrypted] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

export const maskString = (str, visibleCharCount = 4) => {
  if (!str) return '******';
  if (str.length <= visibleCharCount) return '*'.repeat(str.length);
  return '*'.repeat(str.length - visibleCharCount) + str.slice(-visibleCharCount);
};
