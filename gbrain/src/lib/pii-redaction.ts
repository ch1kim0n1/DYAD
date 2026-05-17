/**
 * Enhanced PII redaction beyond simple regex
 * Uses NLP-style detection for names, contextual identifiers, and slang
 */

export interface RedactionResult {
  text: string;
  redactedCount: number;
  detectedTypes: string[];
}

export interface PIIEntity {
  text: string;
  type: 'name' | 'email' | 'phone' | 'ssn' | 'address' | 'date' | 'id' | 'contextual' | 'slang';
  confidence: number;
  start: number;
  end: number;
}

/**
 * Enhanced PII detection and redaction
 */
export class PIIRedactor {
  private namePatterns: RegExp[];
  private contextualPatterns: RegExp[];
  private slangPatterns: Map<string, RegExp[]>;

  constructor() {
    this.namePatterns = [
      // Common name patterns
      /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // First Last
      /\b[A-Z]\. [A-Z][a-z]+\b/g, // Initial Last
      /\b[A-Z][a-z]+ [A-Z]\.?\b/g, // First Initial
    ];

    this.contextualPatterns = [
      // Contextual identifiers
      /\b(?:my|his|her|their) (?:wife|husband|partner|spouse|girlfriend|boyfriend|mom|dad|mother|father|son|daughter|sister|brother|friend)\b/gi,
      /\b(?:dr\.|doctor|mr\.|mrs\.|ms\.) [a-z]+/gi,
      /\b(?:says|said|told|texted|called) (?:me|him|her|them)\b/gi,
    ];

    this.slangPatterns = new Map([
      ['relationship_slang', [
        /\bbabe\b/gi,
        /\bboo\b/gi,
        /\bhoney\b/gi,
        /\bsweetie\b/gi,
        /\blove\b/gi,
        /\bbaby\b/gi,
      ]],
      ['family_slang', [
        /\bmama\b/gi,
        /\bpapa\b/gi,
        /\bgranny\b/gi,
        /\bgrandma\b/gi,
        /\bgrandpa\b/gi,
      ]],
      ['affectionate_terms', [
        /\bdear\b/gi,
        /\bdarling\b/gi,
        /\bsweetheart\b/gi,
      ]],
    ]);
  }

  /**
   * Detect PII entities in text
   */
  detectPII(text: string): PIIEntity[] {
    const entities: PIIEntity[] = [];

    // Detect names
    for (const pattern of this.namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: 'name',
          confidence: 0.7,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Detect emails
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let emailMatch;
    while ((emailMatch = emailPattern.exec(text)) !== null) {
      entities.push({
        text: emailMatch[0],
        type: 'email',
        confidence: 0.95,
        start: emailMatch.index,
        end: emailMatch.index + emailMatch[0].length,
      });
    }

    // Detect phone numbers
    const phonePattern = /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;
    let phoneMatch;
    while ((phoneMatch = phonePattern.exec(text)) !== null) {
      entities.push({
        text: phoneMatch[0],
        type: 'phone',
        confidence: 0.9,
        start: phoneMatch.index,
        end: phoneMatch.index + phoneMatch[0].length,
      });
    }

    // Detect SSN-like patterns
    const ssnPattern = /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g;
    let ssnMatch;
    while ((ssnMatch = ssnPattern.exec(text)) !== null) {
      entities.push({
        text: ssnMatch[0],
        type: 'ssn',
        confidence: 0.85,
        start: ssnMatch.index,
        end: ssnMatch.index + ssnMatch[0].length,
      });
    }

    // Detect contextual identifiers
    for (const pattern of this.contextualPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: 'contextual',
          confidence: 0.6,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Detect slang terms
    for (const [category, patterns] of this.slangPatterns.entries()) {
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          entities.push({
            text: match[0],
            type: 'slang',
            confidence: 0.5,
            start: match.index,
            end: match.index + match[0].length,
          });
        }
      }
    }

    // Sort by position and remove overlaps
    return this.removeOverlaps(entities);
  }

  /**
   * Redact PII from text
   */
  redact(text: string, options: {
    preserveLength?: boolean;
    customPlaceholder?: string;
    includeTypes?: string[];
  } = {}): RedactionResult {
    const {
      preserveLength = false,
      customPlaceholder = '[REDACTED]',
      includeTypes,
    } = options;

    const entities = this.detectPII(text);
    const filteredEntities = includeTypes
      ? entities.filter(e => includeTypes.includes(e.type))
      : entities;

    if (filteredEntities.length === 0) {
      return {
        text,
        redactedCount: 0,
        detectedTypes: [],
      };
    }

    let redactedText = text;
    const detectedTypes = new Set<string>();

    // Sort by position in reverse order to avoid index shifting
    filteredEntities.sort((a, b) => b.start - a.start);

    for (const entity of filteredEntities) {
      detectedTypes.add(entity.type);
      
      const placeholder = preserveLength
        ? this.createPlaceholder(entity.text.length, entity.type)
        : customPlaceholder;

      redactedText =
        redactedText.substring(0, entity.start) +
        placeholder +
        redactedText.substring(entity.end);
    }

    return {
      text: redactedText,
      redactedCount: filteredEntities.length,
      detectedTypes: Array.from(detectedTypes),
    };
  }

  /**
   * Create a placeholder that preserves the original length
   */
  private createPlaceholder(length: number, type: string): string {
    const typeChar = type.charAt(0).toUpperCase();
    return '█'.repeat(length);
  }

  /**
   * Remove overlapping entities
   */
  private removeOverlaps(entities: PIIEntity[]): PIIEntity[] {
    const nonOverlapping: PIIEntity[] = [];
    
    // Sort by start position
    entities.sort((a, b) => a.start - b.start);
    
    for (const entity of entities) {
      if (nonOverlapping.length === 0) {
        nonOverlapping.push(entity);
        continue;
      }
      
      const last = nonOverlapping[nonOverlapping.length - 1];
      if (entity.start >= last.end) {
        nonOverlapping.push(entity);
      } else if (entity.confidence > last.confidence) {
        nonOverlapping[nonOverlapping.length - 1] = entity;
      }
    }
    
    return nonOverlapping;
  }

  /**
   * Redact JSON object recursively
   */
  redactJSON(obj: any, options: Parameters<typeof this.redact>[1] = {}): any {
    if (typeof obj === 'string') {
      return this.redact(obj, options).text;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.redactJSON(item, options));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.redactJSON(value, options);
      }
      return result;
    }
    
    return obj;
  }
}

// Global PII redactor instance
export const piiRedactor = new PIIRedactor();
