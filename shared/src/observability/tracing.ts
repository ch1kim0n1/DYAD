/**
 * Distributed Tracing with OpenTelemetry
 * 
 * Provides distributed tracing capabilities across G-Stack tools
 * for end-to-end request tracking and performance analysis.
 */

import { trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Initialize OpenTelemetry
let tracerInitialized = false;

export function initializeTracing(serviceName: string, exporterUrl?: string): void {
  if (tracerInitialized) {
    return;
  }

  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: '0.5.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    })
  );

  const provider = new NodeTracerProvider({ resource });

  // Add OTLP exporter if URL is provided
  if (exporterUrl) {
    const exporter = new OTLPTraceExporter({ url: exporterUrl });
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  }

  // Register the provider
  provider.register();
  tracerInitialized = true;
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}

// Span context management
export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export function getCurrentSpanContext(): SpanContext | null {
  const span = trace.getActiveSpan();
  if (!span) {
    return null;
  }

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    parentSpanId: span.parentSpanId,
  };
}

export function injectSpanContext(headers: Record<string, string>): Record<string, string> {
  const spanContext = getCurrentSpanContext();
  if (!spanContext) {
    return headers;
  }

  return {
    ...headers,
    'x-trace-id': spanContext.traceId,
    'x-span-id': spanContext.spanId,
    'x-parent-span-id': spanContext.parentSpanId || '',
  };
}

export function extractSpanContext(headers: Record<string, string>): SpanContext | null {
  const traceId = headers['x-trace-id'] || headers['x-b3-traceid'];
  const spanId = headers['x-span-id'] || headers['x-b3-spanid'];
  const parentSpanId = headers['x-parent-span-id'] || headers['x-b3-parentspanid'];

  if (!traceId || !spanId) {
    return null;
  }

  return {
    traceId,
    spanId,
    parentSpanId,
  };
}

// Tracing utilities
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  const tracer = getTracer('gstack');
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  });
}

export function addSpanAttributes(attributes: Record<string, unknown>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

export function addSpanEvent(name: string, attributes?: Record<string, unknown>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

export function recordException(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
  }
}
