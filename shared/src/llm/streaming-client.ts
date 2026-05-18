/**
 * Streaming LLM Client
 * 
 * Provides streaming support for LLM API responses from Anthropic and OpenAI.
 * Supports real-time token streaming with backpressure handling.
 */

export interface StreamingOptions {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
  timeoutMs?: number;
  onToken?: (token: string) => void;
  onComplete?: (response: string) => void;
  onError?: (error: Error) => void;
}

export interface StreamingResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export class StreamingLLMClient {
  constructor() {}

  /**
   * Stream response from Anthropic API
   */
  async streamAnthropic(options: StreamingOptions): Promise<StreamingResult> {
    const apiKey = options.apiKey || this.getApiKey('anthropic');
    if (!apiKey) {
      throw new Error('Anthropic API key not found');
    }

    const timeoutMs = options.timeoutMs || 120000; // 2 minutes default
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          max_tokens: options.maxTokens || 4096,
          messages: [{ role: 'user', content: options.prompt }],
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';
      let outputTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  const token = parsed.delta.text;
                  fullResponse += token;
                  outputTokens++;
                  if (options.onToken) {
                    options.onToken(token);
                  }
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (options.onComplete) {
        options.onComplete(fullResponse);
      }

      // Calculate cost
      const inputTokens = this.estimateTokens(options.prompt);
      const costUsd = this.calculateCost('anthropic', options.model, inputTokens, outputTokens);

      return {
        response: fullResponse,
        inputTokens,
        outputTokens,
        costUsd,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Stream response from OpenAI API
   */
  async streamOpenAI(options: StreamingOptions): Promise<StreamingResult> {
    const apiKey = options.apiKey || this.getApiKey('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const timeoutMs = options.timeoutMs || 120000; // 2 minutes default
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: [{ role: 'user', content: options.prompt }],
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';
      let outputTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.choices?.[0]?.delta?.content) {
                  const token = parsed.choices[0].delta.content;
                  fullResponse += token;
                  outputTokens++;
                  if (options.onToken) {
                    options.onToken(token);
                  }
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (options.onComplete) {
        options.onComplete(fullResponse);
      }

      // Calculate cost
      const inputTokens = this.estimateTokens(options.prompt);
      const costUsd = this.calculateCost('openai', options.model, inputTokens, outputTokens);

      return {
        response: fullResponse,
        inputTokens,
        outputTokens,
        costUsd,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Stream response (auto-detect provider based on model)
   */
  async stream(options: StreamingOptions): Promise<StreamingResult> {
    const model = options.model.toLowerCase();
    
    if (model.includes('claude') || model.includes('anthropic')) {
      return this.streamAnthropic(options);
    } else if (model.includes('gpt') || model.includes('openai')) {
      return this.streamOpenAI(options);
    } else {
      throw new Error(`Unknown model provider for: ${options.model}`);
    }
  }

  /**
   * Get API key from environment or secret manager
   */
  private getApiKey(provider: string): string | null {
    const envVar = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    return process.env[envVar] || null;
  }

  /**
   * Estimate token count for a string
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost based on provider and model
   */
  private calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    // Simplified pricing (in USD per 1M tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
      'claude-opus-4-7': { input: 5.0, output: 25.0 },
      'claude-haiku-4-5': { input: 1.0, output: 5.0 },
      'gpt-4o': { input: 2.5, output: 10.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4o'];
    const inputCost = (inputTokens / 1000000) * modelPricing.input;
    const outputCost = (outputTokens / 1000000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
}

/**
 * Global streaming client instance
 */
let globalStreamingClient: StreamingLLMClient | null = null;

export function getStreamingClient(): StreamingLLMClient {
  if (!globalStreamingClient) {
    globalStreamingClient = new StreamingLLMClient();
  }
  return globalStreamingClient;
}
