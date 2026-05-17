import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Encryption utilities for data at rest
 * Uses AES-256-GCM with PBKDF2 key derivation
 */
export class Encryption {
  private static deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param data - Data to encrypt (string or Buffer)
   * @param password - Encryption key (from environment variable)
   * @returns Base64 encoded encrypted data with salt, IV, and auth tag
   */
  static encrypt(data: string | Buffer, password: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.deriveKey(password, salt);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted: Buffer;
    if (typeof data === 'string') {
      encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    } else {
      encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    }
    
    const tag = cipher.getAuthTag();
    
    // Format: salt + iv + tag + encrypted
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param encryptedData - Base64 encoded encrypted data
   * @param password - Decryption key (from environment variable)
   * @returns Decrypted string
   */
  static decrypt(encryptedData: string, password: string): string {
    const combined = Buffer.from(encryptedData, 'base64');
    
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = combined.subarray(ENCRYPTED_POSITION);
    
    const key = this.deriveKey(password, salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Encrypt JSON object
   */
  static encryptJSON(obj: any, password: string): string {
    return this.encrypt(JSON.stringify(obj), password);
  }

  /**
   * Decrypt JSON object
   */
  static decryptJSON<T>(encryptedData: string, password: string): T {
    const decrypted = this.decrypt(encryptedData, password);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Generate a random encryption key
   */
  static generateKey(): string {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  }

  /**
   * Hash data for verification (not encryption)
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

/**
 * Field-level encryption for sensitive database fields
 */
export class FieldEncryption {
  private password: string;

  constructor(password: string) {
    if (!password) {
      throw new Error('Encryption password is required');
    }
    this.password = password;
  }

  /**
   * Encrypt a field value
   */
  encryptField(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return Encryption.encrypt(value, this.password);
  }

  /**
   * Decrypt a field value
   */
  decryptField(encryptedValue: string | null | undefined): string | null {
    if (encryptedValue === null || encryptedValue === undefined) {
      return null;
    }
    try {
      return Encryption.decrypt(encryptedValue, this.password);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Encrypt multiple fields in an object
   */
  encryptFields<T extends Record<string, any>>(
    obj: T,
    fieldsToEncrypt: (keyof T)[]
  ): T {
    const result = { ...obj };
    for (const field of fieldsToEncrypt) {
      if (result[field] !== null && result[field] !== undefined) {
        result[field] = this.encryptField(String(result[field])) as any;
      }
    }
    return result;
  }

  /**
   * Decrypt multiple fields in an object
   */
  decryptFields<T extends Record<string, any>>(
    obj: T,
    fieldsToDecrypt: (keyof T)[]
  ): T {
    const result = { ...obj };
    for (const field of fieldsToDecrypt) {
      if (result[field] !== null && result[field] !== undefined) {
        result[field] = this.decryptField(String(result[field])) as any;
      }
    }
    return result;
  }
}
