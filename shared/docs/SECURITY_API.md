# Security Utilities API Documentation

This document provides detailed API documentation for the security utilities in the g-stack shared module.

## Table of Contents

- [Input Sanitizer](#input-sanitizer)
- [Secret Manager](#secret-manager)
- [Rate Limiter](#rate-limiter)
- [Audit Logger](#audit-logger)

---

## Input Sanitizer

The input sanitizer protects against shell injection, path traversal, and other input-based attacks.

### Functions

#### `sanitizeInput(input: string, maxLength?: number): string`

Sanitizes a string by removing dangerous characters and limiting length.

**Parameters:**
- `input` (string): The input string to sanitize
- `maxLength` (number, optional): Maximum allowed length (default: 10000)

**Returns:** Sanitized string

**Example:**
```typescript
import { sanitizeInput } from '../src/security/input-sanitizer';

const safe = sanitizeInput('user input; rm -rf');
// Returns: 'user input rm -rf'
```

#### `sanitizeCLIArgument(flag: string, value: string): string`

Validates and formats a CLI argument pair.

**Parameters:**
- `flag` (string): The flag name (e.g., `--config`)
- `value` (string): The flag value

**Returns:** Formatted argument string (e.g., `--config=value`)

**Throws:** Error if flag format is invalid or value contains shell metacharacters

**Example:**
```typescript
const arg = sanitizeCLIArgument('--config', 'file.json');
// Returns: '--config=file.json'
```

#### `sanitizeFilePath(path: string, relativeOnly?: boolean): string`

Validates a file path to prevent directory traversal attacks.

**Parameters:**
- `path` (string): The file path to validate
- `relativeOnly` (boolean, optional): Require relative paths only (default: false)

**Returns:** Validated path string

**Throws:** Error if path contains traversal sequences (`../`, `..\\`)

**Example:**
```typescript
const safe = sanitizeFilePath('./config/file.json');
// Returns: './config/file.json'

sanitizeFilePath('../../../etc/passwd');
// Throws: Error
```

---

## Secret Manager

The secret manager provides secure storage and retrieval of API keys and other secrets.

### Classes

#### `SecretManager`

Manages secrets with support for multiple backends (environment, file, keyring).

**Constructor:**
```typescript
constructor(config: SecretManagerConfig)
```

**Config Interface:**
```typescript
interface SecretManagerConfig {
  backend: SecretBackend; // 'env' | 'file' | 'keyring'
  filePath?: string; // Path to encrypted secrets file
  encryptionKey?: string; // Encryption key for file backend
}
```

**Methods:**

##### `async setSecret(key: string, value: string): Promise<void>`

Store a secret.

**Parameters:**
- `key` (string): Secret key/identifier
- `value` (string): Secret value

**Example:**
```typescript
await secretManager.setSecret('anthropic_api_key', 'sk-ant-...');
```

##### `async getSecret(key: string): Promise<string | null>`

Retrieve a secret.

**Parameters:**
- `key` (string): Secret key/identifier

**Returns:** Secret value or null if not found

**Example:**
```typescript
const key = await secretManager.getSecret('anthropic_api_key');
```

##### `async getApiKey(provider: string): Promise<string | null>`

Get an API key with fallback to common environment variable names.

**Parameters:**
- `provider` (string): Provider name (e.g., 'anthropic', 'openai')

**Returns:** API key or null if not found

**Example:**
```typescript
const key = await secretManager.getApiKey('anthropic');
// Checks: ANTHROPIC_API_KEY, anthropic_api_key, OPENAI_API_KEY
```

##### `async deleteSecret(key: string): Promise<void>`

Delete a secret.

**Parameters:**
- `key` (string): Secret key/identifier

**Example:**
```typescript
await secretManager.deleteSecret('old_key');
```

##### `async listSecrets(): Promise<string[]>`

List all secret keys.

**Returns:** Array of secret key strings

**Example:**
```typescript
const keys = await secretManager.listSecrets();
// Returns: ['anthropic_api_key', 'openai_api_key']
```

##### `clearCache(): void`

Clear the in-memory secret cache.

**Example:**
```typescript
secretManager.clearCache();
```

**Global Instance:**
```typescript
import { getSecretManager } from '../src/security/secret-manager';

const secretManager = getSecretManager({
  backend: 'file',
  filePath: '.gstack/secrets.enc',
});
```

---

## Rate Limiter

The rate limiter prevents abuse with sliding window and token bucket algorithms.

### Classes

#### `RateLimiter`

Sliding window rate limiter.

**Constructor:**
```typescript
constructor(config: RateLimitConfig)
```

**Config Interface:**
```typescript
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipFailedRequests?: boolean; // Don't count failed requests
  skipSuccessfulRequests?: boolean; // Don't count successful requests
}
```

**Methods:**

##### `check(identifier: string): RateLimitResult`

Check if a request is allowed for a given identifier.

**Parameters:**
- `identifier` (string): Unique identifier (IP address, user ID, etc.)

**Returns:** Rate limit result

**Result Interface:**
```typescript
interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: string; // ISO timestamp
}
```

**Example:**
```typescript
const result = limiter.check('user-123');
if (!result.allowed) {
  console.log(`Rate limited. Retry after: ${result.resetTime}`);
}
```

##### `reset(identifier: string): void`

Reset rate limit for a specific identifier.

**Parameters:**
- `identifier` (string): Unique identifier

**Example:**
```typescript
limiter.reset('user-123');
```

##### `getUsage(identifier: string): number`

Get current request count for an identifier.

**Parameters:**
- `identifier` (string): Unique identifier

**Returns:** Current request count

**Example:**
```typescript
const count = limiter.getUsage('user-123');
```

##### `cleanup(): void`

Remove expired entries from the rate limit store.

**Example:**
```typescript
limiter.cleanup();
```

#### `TokenBucketRateLimiter`

Token bucket rate limiter for smoother rate limiting.

**Constructor:**
```typescript
constructor(capacity: number, refillRate: number)
```

**Parameters:**
- `capacity` (number): Maximum token capacity
- `refillRate` (number): Tokens refilled per second

**Methods:**

##### `consume(identifier: string, tokens?: number): RateLimitResult`

Consume tokens from the bucket.

**Parameters:**
- `identifier` (string): Unique identifier
- `tokens` (number, optional): Tokens to consume (default: 1)

**Returns:** Rate limit result

**Example:**
```typescript
const bucket = new TokenBucketRateLimiter(60, 1); // 60 tokens, refill 1/sec
const result = bucket.consume('user-123', 5);
```

##### `reset(identifier: string): void`

Reset token bucket for an identifier.

**Example:**
```typescript
bucket.reset('user-123');
```

##### `getTokens(identifier: string): number`

Get current token count for an identifier.

**Example:**
```typescript
const tokens = bucket.getTokens('user-123');
```

**Presets:**
```typescript
import { RateLimitPresets } from '../src/security/rate-limiter';

const strict = RateLimitPresets.strict; // 10 req/min
const moderate = RateLimitPresets.moderate; // 100 req/min
const lenient = RateLimitPresets.lenient; // 1000 req/min
const burst = RateLimitPresets.burst; // 5 req/sec
```

**Express Middleware:**
```typescript
import { expressRateLimiter, KeyExtractors } from '../src/security/rate-limiter';

const limiter = RateLimitPresets.moderate;
const middleware = expressRateLimiter(limiter, KeyExtractors.byIP);

app.use('/api', middleware);
```

---

## Audit Logger

The audit logger provides structured logging for security events and compliance.

### Classes

#### `AuditLogger`

Logs security events with PII redaction and structured output.

**Constructor:**
```typescript
constructor(logPath?: string, enableConsole?: boolean)
```

**Parameters:**
- `logPath` (string, optional): Path to audit log file (default: `.gstack/audit.log`)
- `enableConsole` (boolean, optional): Also log to console (default: false)

**Methods:**

##### `async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>`

Log a generic audit event.

**Event Interface:**
```typescript
interface AuditEvent {
  id: string; // Auto-generated UUID
  timestamp: string; // Auto-generated ISO timestamp
  event_type: AuditEventType;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  actor_id?: string;
  actor_type?: 'user' | 'service' | 'system';
  resource_id?: string;
  resource_type?: string;
  action: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  success: boolean;
  error_message?: string;
}
```

**Event Types:**
- `AUTHENTICATION`
- `AUTHORIZATION`
- `DATA_ACCESS`
- `DATA_MODIFICATION`
- `CONFIGURATION_CHANGE`
- `SECURITY_EVENT`
- `RATE_LIMIT_EXCEEDED`
- `INVALID_INPUT`
- `SUSPICIOUS_ACTIVITY`

**Example:**
```typescript
await auditLogger.logEvent({
  event_type: 'AUTHENTICATION',
  severity: 'INFO',
  actor_id: 'user-123',
  actor_type: 'user',
  action: 'login',
  success: true,
  ip_address: '1.2.3.4',
});
```

##### `async queryEvents(startDate: string, endDate: string, filters?): Promise<AuditEvent[]>`

Query audit events by date range.

**Parameters:**
- `startDate` (string): Start date (ISO format)
- `endDate` (string): End date (ISO format)
- `filters` (object, optional): Filter criteria

**Filter Interface:**
```typescript
interface QueryFilters {
  event_type?: AuditEventType;
  actor_id?: string;
  resource_id?: string;
}
```

**Example:**
```typescript
const events = await auditLogger.queryEvents(
  '2026-05-13T00:00:00Z',
  '2026-05-13T23:59:59Z',
  { event_type: 'AUTHENTICATION' }
);
```

##### `async getRecentEvents(limit?: number): Promise<AuditEvent[]>`

Get the most recent audit events.

**Parameters:**
- `limit` (number, optional): Maximum number of events (default: 100)

**Example:**
```typescript
const recent = await auditLogger.getRecentEvents(50);
```

**Convenience Methods:**

##### `async logAuthentication(actorId: string, success: boolean, details?): Promise<void>`

Log authentication event.

**Example:**
```typescript
await auditLogger.logAuthentication('user-123', true, { method: 'password' });
```

##### `async logAuthorization(actorId: string, resourceType: string, resourceId: string, action: string, success: boolean): Promise<void>`

Log authorization event.

**Example:**
```typescript
await auditLogger.logAuthorization('user-123', 'file', 'file-456', 'read', true);
```

##### `async logDataAccess(actorId: string, resourceType: string, resourceId: string, details?): Promise<void>`

Log data access event.

**Example:**
```typescript
await auditLogger.logDataAccess('user-123', 'database', 'table-789');
```

##### `async logDataModification(actorId: string, resourceType: string, resourceId: string, action: string, details?): Promise<void>`

Log data modification event.

**Example:**
```typescript
await auditLogger.logDataModification('user-123', 'file', 'file-456', 'update');
```

##### `async logSecurityEvent(severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL', action: string, details?): Promise<void>`

Log generic security event.

**Example:**
```typescript
await auditLogger.logSecurityEvent('WARNING', 'suspicious_activity', { ip: '1.2.3.4' });
```

##### `async logRateLimitExceeded(identifier: string, details?): Promise<void>`

Log rate limit exceeded event.

**Example:**
```typescript
await auditLogger.logRateLimitExceeded('user-123', { endpoint: '/api/query' });
```

##### `async logInvalidInput(actorId: string, fieldName: string, reason: string, details?): Promise<void>`

Log invalid input event.

**Example:**
```typescript
await auditLogger.logInvalidInput('user-123', 'email', 'invalid format');
```

**Global Instance:**
```typescript
import { getAuditLogger } from '../src/security/audit-log';

const auditLogger = getAuditLogger('.gstack/audit.log', true);
```

---

## Best Practices

1. **Always sanitize user input** before using it in shell commands or file operations
2. **Use the secret manager** for all sensitive data (API keys, tokens, passwords)
3. **Apply rate limiting** to all public-facing endpoints
4. **Log security events** for compliance and debugging
5. **Use appropriate log levels** (DEBUG for development, INFO for normal operations, WARN for potential issues, ERROR for failures)
6. **Set reasonable rate limits** based on your use case (e.g., 100 req/min for user actions, 1000 req/min for API endpoints)
7. **Regularly review audit logs** for suspicious activity
8. **Rotate secrets regularly** using the secret manager's delete/set methods
