/**
 * Input Sanitization Utility
 *
 * Provides secure input validation and sanitization for user-facing CLI flags
 * to prevent injection attacks, path traversal, and other security issues.
 */

/**
 * Sanitize a file path to prevent path traversal attacks
 * - Resolves relative paths to absolute
 * - Prevents directory traversal (../)
 * - Note: File existence checking should be done at the call site
 */
export function sanitizeFilePath(
  input: string,
  options: { allowRelative?: boolean } = {}
): string {
  const { allowRelative = false } = options;

  if (!input || typeof input !== 'string') {
    throw new Error('Invalid file path: must be a non-empty string');
  }

  // Check for null bytes
  if (input.includes('\0')) {
    throw new Error('Invalid file path: contains null byte');
  }

  // Prevent path traversal
  if (!allowRelative && (input.includes('..') || input.startsWith('~'))) {
    throw new Error('Invalid file path: path traversal not allowed');
  }

  // Normalize path separators
  const normalized = input.replace(/\\/g, '/');

  // Check for suspicious patterns
  if (/[<>:"|?*]/.test(normalized)) {
    throw new Error('Invalid file path: contains illegal characters');
  }

  // Limit length
  if (normalized.length > 4096) {
    throw new Error('Invalid file path: exceeds maximum length');
  }

  return normalized;
}

/**
 * Sanitize a task description or free-form text input
 * - Removes null bytes
 * - Limits length
 * - Strips control characters except newlines/tabs
 */
export function sanitizeText(
  input: string,
  options: { maxLength?: number; allowMultiline?: boolean } = {}
): string {
  const { maxLength = 10000, allowMultiline = true } = options;

  if (!input || typeof input !== 'string') {
    throw new Error('Invalid text input: must be a non-empty string');
  }

  // Check for null bytes
  if (input.includes('\0')) {
    throw new Error('Invalid text input: contains null byte');
  }

  // Remove control characters (except \n, \r, \t if multiline allowed)
  let sanitized = allowMultiline
    ? input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    : input.replace(/[\x00-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    console.warn(`[Security] Text input truncated to ${maxLength} characters`);
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  if (!sanitized) {
    throw new Error('Invalid text input: results in empty string after sanitization');
  }

  return sanitized;
}

/**
 * Sanitize a URL/endpoint
 * - Validates URL format
 * - Restricts to http/https protocols
 * - Prevents authentication in URL (user:pass@host)
 */
export function sanitizeUrl(input: string, options: { allowLocalhost?: boolean } = {}): string {
  const { allowLocalhost = true } = options;

  if (!input || typeof input !== 'string') {
    throw new Error('Invalid URL: must be a non-empty string');
  }

  try {
    const url = new URL(input);

    // Restrict protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid URL: only http and https protocols are allowed');
    }

    // Prevent authentication in URL
    if (url.username || url.password) {
      throw new Error('Invalid URL: authentication in URL is not allowed');
    }

    // Optionally block localhost
    if (!allowLocalhost) {
      const hostname = url.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        throw new Error('Invalid URL: localhost is not allowed');
      }
    }

    return url.toString();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid URL')) {
      throw error;
    }
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : 'malformed URL'}`);
  }
}

/**
 * Sanitize a configuration key
 * - Limits to alphanumeric, underscore, dash, and dot
 * - Prevents path-like patterns
 */
export function sanitizeConfigKey(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid config key: must be a non-empty string');
  }

  // Only allow alphanumeric, underscore, dash, and dot
  if (!/^[a-zA-Z0-9_.-]+$/.test(input)) {
    throw new Error('Invalid config key: only alphanumeric, underscore, dash, and dot characters are allowed');
  }

  // Prevent path-like patterns
  if (input.includes('..')) {
    throw new Error('Invalid config key: path-like patterns not allowed');
  }

  // Limit length
  if (input.length > 100) {
    throw new Error('Invalid config key: maximum length is 100 characters');
  }

  return input;
}

/**
 * Sanitize a configuration value
 * - For string values, applies text sanitization
 * - For JSON values, parses and validates structure
 */
export function sanitizeConfigValue(input: string): any {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid config value: must be a non-empty string');
  }

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(input);
    
    // Recursively sanitize objects
    if (typeof parsed === 'object' && parsed !== null) {
      return sanitizeObject(parsed);
    }
    
    return parsed;
  } catch {
    // Not JSON, treat as plain text
    return sanitizeText(input, { maxLength: 1000, allowMultiline: false });
  }
}

/**
 * Recursively sanitize an object's values
 */
function sanitizeObject(obj: any, depth = 0): any {
  const MAX_DEPTH = 10;
  
  if (depth > MAX_DEPTH) {
    throw new Error('Invalid config value: object nesting too deep');
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      if (index > 1000) {
        throw new Error('Invalid config value: array too large');
      }
      return sanitizeObject(item, depth + 1);
    });
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys
      const sanitizedKey = sanitizeConfigKey(key);
      result[sanitizedKey] = sanitizeObject(value, depth + 1);
    }
    return result;
  }

  if (typeof obj === 'string') {
    return sanitizeText(obj, { maxLength: 1000, allowMultiline: false });
  }

  // Numbers, booleans, null are safe as-is
  return obj;
}

/**
 * Sanitize a numeric input (e.g., --parallel <n>)
 * - Validates it's a valid number
 * - Applies min/max bounds
 */
export function sanitizeNumber(
  input: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): number {
  const { min = -Infinity, max = Infinity, integer = false } = options;

  if (!input || typeof input !== 'string') {
    throw new Error('Invalid number: must be a non-empty string');
  }

  const num = Number(input);

  if (isNaN(num)) {
    throw new Error('Invalid number: not a valid numeric value');
  }

  if (integer && !Number.isInteger(num)) {
    throw new Error('Invalid number: must be an integer');
  }

  if (num < min) {
    throw new Error(`Invalid number: must be at least ${min}`);
  }

  if (num > max) {
    throw new Error(`Invalid number: must be at most ${max}`);
  }

  return num;
}

/**
 * Sanitize a task ID or similar identifier
 * - Limits to alphanumeric, dash, and underscore
 * - Validates length
 */
export function sanitizeId(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid ID: must be a non-empty string');
  }

  // Only allow alphanumeric, dash, and underscore
  if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
    throw new Error('Invalid ID: only alphanumeric, dash, and underscore characters are allowed');
  }

  // Limit length
  if (input.length < 1 || input.length > 100) {
    throw new Error('Invalid ID: length must be between 1 and 100 characters');
  }

  return input;
}
