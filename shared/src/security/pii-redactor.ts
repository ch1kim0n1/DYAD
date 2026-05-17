/**
 * PII Redaction Utility
 *
 * Provides redaction of Personally Identifiable Information (PII) from logs and receipts
 * to protect user privacy and comply with data protection regulations (GDPR, CCPA, etc.)
 */

/**
 * Common PII patterns for redaction
 */
const PII_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (various formats)
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  
  // Social Security Numbers (US format)
  ssn: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
  
  // Credit card numbers (simplified pattern)
  creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
  
  // IP addresses (both IPv4 and IPv6)
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  
  // URLs that might contain sensitive info
  url: /\bhttps?:\/\/[^\s<>"{}|\\^`\[\]]+\b/g,
  
  // API keys (common patterns)
  apiKey: /\b[A-Za-z0-9]{32,}\b/g,
  
  // UUIDs/GUIDs
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  
  // File paths that might contain user info
  filePath: /\b(?:[A-Za-z]:)?[\\/](?:[^\\/:*?"<>|\r\n]+[\\/])*[^\\/:*?"<>|\r\n]*\b/g,
  
  // Potential passwords (quoted strings that look like secrets)
  password: /(?:password|passwd|pwd|secret|token|api[_-]?key)["']?\s*[:=]\s*["']?([^"'\s]{8,})/gi,
};

/**
 * Redaction placeholder
 */
const REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * Custom patterns for specific contexts (e.g., user-defined sensitive fields)
 */
const customPatterns: Map<string, RegExp> = new Map();

/**
 * Add a custom PII pattern for redaction
 */
export function addCustomPattern(name: string, pattern: RegExp): void {
  customPatterns.set(name, pattern);
}

/**
 * Remove a custom PII pattern
 */
export function removeCustomPattern(name: string): void {
  customPatterns.delete(name);
}

/**
 * Redact PII from a string using default patterns
 */
export function redactPII(
  input: string,
  options: {
    patterns?: Array<keyof typeof PII_PATTERNS | string>;
    customPlaceholder?: string;
    preserveStructure?: boolean;
  } = {}
): string {
  const { patterns, customPlaceholder = REDACTION_PLACEHOLDER, preserveStructure = true } = options;

  if (!input || typeof input !== 'string') {
    return input;
  }

  let result = input;

  // Determine which patterns to use
  const patternsToUse = patterns || Object.keys(PII_PATTERNS) as Array<keyof typeof PII_PATTERNS | string>;

  for (const patternName of patternsToUse) {
    let pattern: RegExp | undefined;
    
    if (patternName in PII_PATTERNS) {
      pattern = PII_PATTERNS[patternName as keyof typeof PII_PATTERNS];
    } else {
      pattern = customPatterns.get(patternName);
    }

    if (!pattern) continue;

    if (preserveStructure) {
      // Preserve structure by matching length
      result = result.replace(pattern, (match) => {
        // For structured redaction, preserve some format info
        if (match.includes('@')) {
          // Email: preserve domain, redact local part
          const [local, domain] = match.split('@');
          return `${customPlaceholder}@${domain}`;
        }
        if (match.includes('.')) {
          // IP address or SSN: preserve format
          const parts = match.split(/[.-]/);
          return parts.map((part, i) => i === 0 ? customPlaceholder : part).join(match.includes('.') ? '.' : '-');
        }
        // Default: full redaction
        return customPlaceholder;
      });
    } else {
      // Full redaction
      result = result.replace(pattern, customPlaceholder);
    }
  }

  return result;
}

/**
 * Redact PII from an object recursively
 */
export function redactPIIObject(
  obj: any,
  options: {
    patterns?: Array<keyof typeof PII_PATTERNS | string>;
    customPlaceholder?: string;
    preserveStructure?: boolean;
    skipKeys?: string[];
  } = {}
): any {
  const { patterns, customPlaceholder = REDACTION_PLACEHOLDER, preserveStructure = true, skipKeys = [] } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactPII(obj, { patterns, customPlaceholder, preserveStructure });
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactPIIObject(item, { patterns, customPlaceholder, preserveStructure, skipKeys }));
  }

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip keys that are explicitly marked as safe
      if (skipKeys.includes(key)) {
        result[key] = value;
        continue;
      }

      // Skip keys that are already redacted
      if (key.toLowerCase().includes('redacted') || key.toLowerCase().includes('sanitized')) {
        result[key] = value;
        continue;
      }

      // Recursively redact nested objects
      result[key] = redactPIIObject(value, { patterns, customPlaceholder, preserveStructure, skipKeys });
    }
    return result;
  }

  // Numbers, booleans, etc. are returned as-is
  return obj;
}

/**
 * Redact PII from a receipt object specifically
 */
export function redactReceiptPII(
  receipt: any,
  options: {
    customPlaceholder?: string;
    preserveStructure?: boolean;
  } = {}
): any {
  const { customPlaceholder = REDACTION_PLACEHOLDER, preserveStructure = true } = options;

  // Fields that should never be redacted (metadata, IDs, etc.)
  const safeKeys = [
    'task_id',
    'schema_version',
    'timestamp',
    'tool_name',
    'corpus_sha8',
    'model_id',
    'tier',
    'cost_usd',
    'duration_ms',
    'status',
    'score',
    'metrics',
    'verdicts',
    'escalation_metrics',
  ];

  return redactPIIObject(receipt, {
    patterns: ['email', 'phone', 'ssn', 'creditCard', 'ipAddress', 'apiKey', 'password'],
    customPlaceholder,
    preserveStructure,
    skipKeys: safeKeys,
  });
}

/**
 * Redact PII from log messages
 */
export function redactLogMessage(
  message: string,
  options: {
    customPlaceholder?: string;
    preserveStructure?: boolean;
  } = {}
): string {
  const { customPlaceholder = REDACTION_PLACEHOLDER, preserveStructure = false } = options;

  return redactPII(message, {
    patterns: ['email', 'phone', 'ssn', 'creditCard', 'apiKey', 'password'],
    customPlaceholder,
    preserveStructure,
  });
}

/**
 * Check if a string contains potential PII
 */
export function containsPII(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  for (const pattern of Object.values(PII_PATTERNS)) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract detected PII types from a string (for audit purposes)
 */
export function detectPIITypes(input: string): string[] {
  if (!input || typeof input !== 'string') {
    return [];
  }

  const detected: string[] = [];

  for (const [name, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(input)) {
      detected.push(name);
    }
  }

  return detected;
}
