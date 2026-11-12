import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function getEncryptionKey() {
  const keyHex = process.env.DOCUMENT_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'DOCUMENT_ENCRYPTION_KEY must be a valid 64-character hexadecimal key.'
    );
  }

  return Buffer.from(keyHex, 'hex');
}

// Encrypt a document buffer using AES-256-GCM.
export function encryptBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Document data must be a Buffer.');
  }

  const key = getEncryptionKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encryptedData: encrypted
  };
}

// Decrypt a previously encrypted document buffer.
export function decryptBuffer(encryptedData, ivHex, authTagHex) {
  const key = getEncryptionKey();

  if (!Buffer.isBuffer(encryptedData)) {
    throw new TypeError('Encrypted document data must be a Buffer.');
  }

  if (!/^[0-9a-fA-F]{24}$/.test(ivHex)) {
    throw new Error('Invalid encryption IV.');
  }

  if (!/^[0-9a-fA-F]{32}$/.test(authTagHex)) {
    throw new Error('Invalid authentication tag.');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);
}