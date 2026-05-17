/**
 * Secret Manager
 * 
 * Provides secure storage and retrieval of secrets (API keys, tokens, etc).
 * Supports multiple backends: environment variables, encrypted file, and system keyring.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export type SecretBackend = 'env' | 'file' | 'keyring';

export interface SecretManagerConfig {
  backend: SecretBackend;
  filePath?: string;
  encryptionKey?: string;
}

export class SecretManager {
  private backend: SecretBackend;
  private filePath: string;
  private encryptionKey: string;
  private cache: Map<string, string>;

  constructor(config: SecretManagerConfig) {
    this.backend = config.backend || 'env';
    this.filePath = config.filePath || path.join(process.cwd(), '.gstack', 'secrets.enc');
    this.encryptionKey = config.encryptionKey || this.getDefaultEncryptionKey();
    this.cache = new Map();
  }

  /**
   * Get default encryption key from environment
   */
  private getDefaultEncryptionKey(): string {
    return process.env.GSTACK_SECRET_KEY || 'default-key-change-in-production';
  }

  /**
   * Encrypt a secret
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a secret
   */
  private decrypt(text: string): string {
    try {
      const parts = text.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt secret: invalid key or corrupted data');
    }
  }

  /**
   * Store a secret
   */
  async setSecret(key: string, value: string): Promise<void> {
    switch (this.backend) {
      case 'env':
        // Environment variables are read-only at runtime
        throw new Error('Cannot write to environment backend');
      
      case 'file':
        await this.setSecretFile(key, value);
        break;
      
      case 'keyring':
        // System keyring integration would go here
        // For now, fall back to file
        await this.setSecretFile(key, value);
        break;
    }
    
    this.cache.set(key, value);
  }

  /**
   * Store a secret in encrypted file
   */
  private async setSecretFile(key: string, value: string): Promise<void> {
    const secrets = await this.loadSecretsFile();
    secrets[key] = this.encrypt(value);
    await this.saveSecretsFile(secrets);
  }

  /**
   * Load secrets from encrypted file
   */
  private async loadSecretsFile(): Promise<Record<string, string>> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  /**
   * Save secrets to encrypted file
   */
  private async saveSecretsFile(secrets: Record<string, string>): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(secrets, null, 2), 'utf8');
  }

  /**
   * Get a secret
   */
  async getSecret(key: string): Promise<string | null> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    let value: string | null = null;

    switch (this.backend) {
      case 'env':
        value = process.env[key] || null;
        break;
      
      case 'file':
      case 'keyring':
        value = await this.getSecretFile(key);
        break;
    }

    if (value) {
      this.cache.set(key, value);
    }

    return value;
  }

  /**
   * Get a secret from encrypted file
   */
  private async getSecretFile(key: string): Promise<string | null> {
    const secrets = await this.loadSecretsFile();
    const encrypted = secrets[key];
    
    if (!encrypted) {
      return null;
    }

    try {
      return this.decrypt(encrypted);
    } catch (error) {
      console.error(`Failed to decrypt secret for key: ${key}`);
      return null;
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(key: string): Promise<void> {
    switch (this.backend) {
      case 'env':
        throw new Error('Cannot delete from environment backend');
      
      case 'file':
      case 'keyring':
        await this.deleteSecretFile(key);
        break;
    }
    
    this.cache.delete(key);
  }

  /**
   * Delete a secret from encrypted file
   */
  private async deleteSecretFile(key: string): Promise<void> {
    const secrets = await this.loadSecretsFile();
    delete secrets[key];
    await this.saveSecretsFile(secrets);
  }

  /**
   * List all secret keys
   */
  async listSecrets(): Promise<string[]> {
    switch (this.backend) {
      case 'env':
        return Object.keys(process.env).filter(key => 
          key.includes('API_KEY') || 
          key.includes('SECRET') || 
          key.includes('TOKEN')
        );
      
      case 'file':
      case 'keyring':
        const secrets = await this.loadSecretsFile();
        return Object.keys(secrets);
    }
  }

  /**
   * Get API key with fallback to environment variable
   */
  async getApiKey(provider: string): Promise<string | null> {
    const key = await this.getSecret(`${provider.toUpperCase()}_API_KEY`);
    if (key) {
      return key;
    }
    
    // Fallback to common environment variable names
    const envKeys = [
      `${provider.toUpperCase()}_API_KEY`,
      `${provider.toUpperCase()}_KEY`,
      `OPENAI_API_KEY`,
      `ANTHROPIC_API_KEY`,
    ];
    
    for (const envKey of envKeys) {
      const value = process.env[envKey];
      if (value) {
        return value;
      }
    }
    
    return null;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Global secret manager instance
 */
let globalSecretManager: SecretManager | null = null;

export function getSecretManager(config?: SecretManagerConfig): SecretManager {
  if (!globalSecretManager) {
    const backend = (process.env.GSTACK_SECRET_BACKEND as SecretBackend) || 'env';
    globalSecretManager = new SecretManager({
      backend,
      filePath: process.env.GSTACK_SECRET_FILE,
      encryptionKey: process.env.GSTACK_SECRET_KEY,
      ...config,
    });
  }
  return globalSecretManager;
}

export function resetSecretManager(): void {
  globalSecretManager = null;
}
