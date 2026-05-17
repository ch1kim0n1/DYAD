import crypto from 'crypto';
import { createLogger } from '../logger';

const logger = createLogger('key-rotation');

export interface KeyMetadata {
  keyId: string;
  createdAt: Date;
  expiresAt: Date;
  algorithm: string;
  keyLength: number;
  status: 'active' | 'deprecated' | 'revoked';
}

/**
 * Key rotation and secrets management
 * Implements secure key lifecycle management
 */
export class KeyRotationManager {
  private keys: Map<string, { key: string; metadata: KeyMetadata }> = new Map();
  private rotationInterval: number; // days
  private keyHistoryLimit: number;

  constructor(rotationIntervalDays: number = 90, keyHistoryLimit: number = 3) {
    this.rotationInterval = rotationIntervalDays;
    this.keyHistoryLimit = keyHistoryLimit;
  }

  /**
   * Generate a new encryption key
   */
  generateKey(): { keyId: string; key: string; metadata: KeyMetadata } {
    const keyId = this.generateKeyId();
    const key = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.rotationInterval * 24 * 60 * 60 * 1000);

    const metadata: KeyMetadata = {
      keyId,
      createdAt: now,
      expiresAt,
      algorithm: 'AES-256-GCM',
      keyLength: 256,
      status: 'active',
    };

    this.keys.set(keyId, { key, metadata });

    logger.info(`Generated new encryption key: ${keyId}`);
    
    return { keyId, key, metadata };
  }

  /**
   * Get the active key
   */
  getActiveKey(): { keyId: string; key: string; metadata: KeyMetadata } | null {
    for (const [keyId, { key, metadata }] of this.keys.entries()) {
      if (metadata.status === 'active' && metadata.expiresAt > new Date()) {
        return { keyId, key, metadata };
      }
    }
    return null;
  }

  /**
   * Get a specific key by ID
   */
  getKey(keyId: string): { key: string; metadata: KeyMetadata } | null {
    const entry = this.keys.get(keyId);
    return entry ? { key: entry.key, metadata: entry.metadata } : null;
  }

  /**
   * Rotate the active key
   */
  rotateKey(): { keyId: string; key: string; metadata: KeyMetadata } {
    const activeKey = this.getActiveKey();
    
    if (activeKey) {
      // Mark old key as deprecated
      this.keys.set(activeKey.keyId, {
        key: activeKey.key,
        metadata: { ...activeKey.metadata, status: 'deprecated' },
      });
      
      logger.info(`Deprecated old key: ${activeKey.keyId}`);
    }

    // Generate new active key
    return this.generateKey();
  }

  /**
   * Revoke a key
   */
  revokeKey(keyId: string): boolean {
    const entry = this.keys.get(keyId);
    if (entry) {
      this.keys.set(keyId, {
        key: entry.key,
        metadata: { ...entry.metadata, status: 'revoked' },
      });
      logger.info(`Revoked key: ${keyId}`);
      return true;
    }
    return false;
  }

  /**
   * Clean up old keys
   */
  cleanupOldKeys(): number {
    let removed = 0;
    const now = new Date();
    
    for (const [keyId, { metadata }] of this.keys.entries()) {
      // Remove keys that are both expired and deprecated
      if (metadata.expiresAt < now && metadata.status === 'deprecated') {
        this.keys.delete(keyId);
        removed++;
        logger.info(`Cleaned up old key: ${keyId}`);
      }
    }

    // Enforce history limit
    const allKeys = Array.from(this.keys.entries())
      .sort((a, b) => b[1].metadata.createdAt.getTime() - a[1].metadata.createdAt.getTime());
    
    while (allKeys.length > this.keyHistoryLimit) {
      const [keyId] = allKeys.pop()!;
      this.keys.delete(keyId);
      removed++;
    }

    return removed;
  }

  /**
   * Check if key rotation is needed
   */
  needsRotation(): boolean {
    const activeKey = this.getActiveKey();
    if (!activeKey) {
      return true;
    }

    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (activeKey.metadata.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    return daysUntilExpiry <= 7; // Rotate if expiring within 7 days
  }

  /**
   * Get all key metadata (without actual keys)
   */
  getKeyMetadata(): KeyMetadata[] {
    return Array.from(this.keys.values()).map(({ metadata }) => metadata);
  }

  /**
   * Export keys for backup (encrypted)
   */
  exportKeys(encryptionPassword: string): string {
    const keysArray = Array.from(this.keys.entries());
    const json = JSON.stringify(keysArray);
    
    // Simple encryption for backup
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(encryptionPassword, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Import keys from backup
   */
  importKeys(encryptedData: string, encryptionPassword: string): void {
    const combined = Buffer.from(encryptedData, 'base64');
    const salt = combined.subarray(0, 16);
    const iv = combined.subarray(16, 32);
    const tag = combined.subarray(32, 48);
    const encrypted = combined.subarray(48);
    
    const key = crypto.pbkdf2Sync(encryptionPassword, salt, 100000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const json = decrypted.toString('utf8');
    
    const keysArray = JSON.parse(json);
    for (const [keyId, data] of keysArray) {
      this.keys.set(keyId, data as any);
    }
    
    logger.info(`Imported ${keysArray.length} keys from backup`);
  }

  private generateKeyId(): string {
    return `key-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }
}

/**
 * Secrets management for environment variables and sensitive config
 */
export class SecretsManager {
  private secrets: Map<string, { value: string; encrypted: boolean; lastRotated: Date }> = new Map();

  /**
   * Set a secret value
   */
  setSecret(key: string, value: string, encrypted: boolean = true): void {
    this.secrets.set(key, {
      value: encrypted ? this.encryptSecret(value) : value,
      encrypted,
      lastRotated: new Date(),
    });
  }

  /**
   * Get a secret value
   */
  getSecret(key: string): string | null {
    const secret = this.secrets.get(key);
    if (!secret) {
      return null;
    }
    
    return secret.encrypted ? this.decryptSecret(secret.value) : secret.value;
  }

  /**
   * Rotate a secret
   */
  rotateSecret(key: string, newValue: string): void {
    this.setSecret(key, newValue);
    logger.info(`Rotated secret: ${key}`);
  }

  /**
   * Check if secret needs rotation (older than 30 days)
   */
  needsRotation(key: string): boolean {
    const secret = this.secrets.get(key);
    if (!secret) {
      return false;
    }
    
    const daysSinceRotation = Math.floor(
      (Date.now() - secret.lastRotated.getTime()) / (24 * 60 * 60 * 1000)
    );
    
    return daysSinceRotation >= 30;
  }

  /**
   * Get all secret keys (without values)
   */
  listSecrets(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * Delete a secret
   */
  deleteSecret(key: string): boolean {
    return this.secrets.delete(key);
  }

  private encryptSecret(value: string): string {
    const key = process.env.SECRETS_ENCRYPTION_KEY || 'default-key-change-in-production';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptSecret(encrypted: string): string {
    const key = process.env.SECRETS_ENCRYPTION_KEY || 'default-key-change-in-production';
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Global instances
export const keyRotationManager = new KeyRotationManager();
export const secretsManager = new SecretsManager();
