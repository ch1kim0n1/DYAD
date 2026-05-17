/**
 * Unit tests for Input Sanitizer
 */

import { describe, it, expect } from 'bun:test';
import { sanitizeInput, sanitizeCLIArgument, sanitizeFilePath } from '../src/security/input-sanitizer';

describe('Input Sanitizer', () => {
  describe('sanitizeInput', () => {
    it('should allow safe strings', () => {
      expect(sanitizeInput('hello world')).toBe('hello world');
      expect(sanitizeInput('test123')).toBe('test123');
    });

    it('should remove shell metacharacters', () => {
      expect(sanitizeInput('test; rm -rf')).toBe('test rm -rf');
      expect(sanitizeInput('test && echo')).toBe('test echo');
      expect(sanitizeInput('test | cat')).toBe('test cat');
      expect(sanitizeInput('test `command`')).toBe('test command');
      expect(sanitizeInput('test $(command)')).toBe('test command');
    });

    it('should remove null bytes', () => {
      expect(sanitizeInput('test\x00')).toBe('test');
    });

    it('should limit length', () => {
      const long = 'a'.repeat(10000);
      const result = sanitizeInput(long, 100);
      expect(result.length).toBe(100);
    });
  });

  describe('sanitizeCLIArgument', () => {
    it('should allow safe arguments', () => {
      expect(sanitizeCLIArgument('--config', 'file.json')).toBe('--config=file.json');
    });

    it('should reject shell injection attempts', () => {
      expect(() => sanitizeCLIArgument('--exec', 'rm -rf')).toThrow();
      expect(() => sanitizeCLIArgument('--cmd', '; cat /etc/passwd')).toThrow();
    });

    it('should validate flag format', () => {
      expect(() => sanitizeCLIArgument('invalid-flag', 'value')).toThrow();
      expect(sanitizeCLIArgument('--valid', 'value')).toBe('--valid=value');
    });
  });

  describe('sanitizeFilePath', () => {
    it('should allow safe paths', () => {
      expect(sanitizeFilePath('/home/user/file.txt')).toBe('/home/user/file.txt');
      expect(sanitizeFilePath('./relative/path')).toBe('./relative/path');
    });

    it('should reject path traversal', () => {
      expect(() => sanitizeFilePath('../../../etc/passwd')).toThrow();
      expect(() => sanitizeFilePath('..\\..\\windows\\system32')).toThrow();
    });

    it('should reject absolute paths when relative only', () => {
      expect(() => sanitizeFilePath('/etc/passwd', true)).toThrow();
    });
  });
});
