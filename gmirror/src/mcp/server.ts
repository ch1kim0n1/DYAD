import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '../core/logger.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { GMirror } from '../core/gmirror.js';
import { LocalAuditLogger } from '../core/observability.js';
import { createAuthMiddleware, type AuthConfig, type AuthToken } from '@gstack/shared/core';
import { getDefaultSecretManager, PermissionModel } from '../core/security.js';

type McpScope = 'read' | 'write';

interface IssuedToken {
  scopes: McpScope[];
  expiresAt: number;
}

interface RateWindow {
  minuteCount: number;
  minuteStart: number;
  hourCount: number;
  hourStart: number;
}

/**
 * MCP Server for GMirror
 * 
 * Exposes GMirror functionality as MCP tools for Claude Code and other agents
 * with token-based authentication
 */
class GMirrorMCPServer {
  private server: Server;
  private gmirror: GMirror;
  private authMiddleware: ReturnType<typeof createAuthMiddleware>;
  private issuedTokens = new Map<string, IssuedToken>();
  private rateWindows = new Map<string, RateWindow>();
  private requireAuth: boolean;
  private allowAnonymousRead: boolean;
  private defaultScopes: McpScope[];
  private rateLimitRpm: number;
  private rateLimitRph: number;
  private bootstrapToken?: string;
  private bootstrapScopes: McpScope[];
  private permissions: PermissionModel;
  private securityAudit: LocalAuditLogger;

  constructor(authConfig?: AuthConfig) {
    this.server = new Server(
      {
        name: 'gmirror',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.gmirror = new GMirror();
    this.permissions = PermissionModel.loadDefault();
    this.securityAudit = new LocalAuditLogger('gmirror');

    const env = typeof process !== 'undefined' ? process.env : {};
    const secrets = getDefaultSecretManager();
    this.requireAuth = env.GMIRROR_REQUIRE_AUTH === 'true';
    this.allowAnonymousRead = env.GMIRROR_ALLOW_ANONYMOUS_READ !== 'false';
    this.defaultScopes = this.parseScopes(env.GMIRROR_MCP_DEFAULT_SCOPES || 'read,write');
    this.bootstrapToken = secrets.get('gmirror_mcp_token');
    this.bootstrapScopes = this.parseScopes(env.GMIRROR_MCP_TOKEN_SCOPES || 'read,write');

    // Initialize auth middleware using shared implementation.
    this.authMiddleware = createAuthMiddleware(authConfig || {
      secret: secrets.get('gmirror_auth_secret') || 'dev-secret',
      tool: 'gmirror',
      tokenExpiration: 24 * 60 * 60 * 1000,
      defaultRoles: this.defaultScopes,
    });

    this.rateLimitRpm = this.parseLimit(env.GMIRROR_RATE_LIMIT_RPM, 60);
    this.rateLimitRph = this.parseLimit(env.GMIRROR_RATE_LIMIT_RPH, 1000);

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'gmirror_score',
            description: 'Score a change against synthetic users to detect UX failures, cognitive friction, and manipulation patterns',
            inputSchema: {
              type: 'object',
              properties: {
                payload: {
                  type: 'object',
                  description: 'Change payload to test (code changes, UI changes, etc.)',
                },
                panelSize: {
                  type: 'number',
                  description: 'Number of synthetic users to test against',
                  default: 10,
                },
                mode: {
                  type: 'string',
                  enum: ['change', 'pre_build', 'shadow'],
                  description: 'Test mode',
                  default: 'change',
                },
              },
              required: ['payload'],
            },
          },
          {
            name: 'gmirror_health',
            description: 'Check health of GMirror and its dependencies',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'gmirror_failure_modes',
            description: 'List known failure modes in the library',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'gmirror_get_failure_modes',
            description: 'Get known failure modes in the library',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'gmirror_calibrate',
            description: 'Calibrate synthetic user population to match real user analytics',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'gmirror_get_receipts',
            description: 'Get execution receipts from the receipt registry',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of receipts to return',
                },
                offset: {
                  type: 'number',
                  description: 'Offset for pagination',
                },
                startDate: {
                  type: 'string',
                  description: 'Start date for filtering (ISO 8601)',
                },
                endDate: {
                  type: 'string',
                  description: 'End date for filtering (ISO 8601)',
                },
              },
            },
          },
          {
            name: 'gmirror_get_trend',
            description: 'Get receipt score trend over a time window',
            inputSchema: {
              type: 'object',
              properties: {
                windowDays: {
                  type: 'number',
                  description: 'Number of days to analyze',
                  default: 7,
                },
              },
            },
          },
          {
            name: 'gmirror_get_drift',
            description: 'Get drift statistics for metrics',
            inputSchema: {
              type: 'object',
              properties: {
                metricName: {
                  type: 'string',
                  description: 'Specific metric name to check (optional)',
                },
              },
            },
          },
          {
            name: 'gmirror_get_cost_stats',
            description: 'Get cost statistics from the cost ledger',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls with token auth, read/write scopes, and per-token rate limits.
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const requiredScope = this.requiredScopeForTool(name);
      const auth = this.authorize(request.params._meta, requiredScope);
      if (!auth.ok) {
        this.securityAudit.logSecurityEvent({
          event: 'mcp_auth_denied',
          target: name,
          scope: requiredScope,
          success: false,
          error: auth.error,
        });
        return this.errorResponse(auth.error);
      }

      const rateLimit = this.checkRateLimit(auth.token);
      if (!rateLimit.allowed) {
        this.securityAudit.logSecurityEvent({
          event: 'mcp_rate_limited',
          actor: this.tokenLabel(auth.token),
          target: name,
          scope: requiredScope,
          success: false,
          metadata: { reset_at: rateLimit.resetAt },
        });
        return this.errorResponse(`Rate limit exceeded. Reset at ${rateLimit.resetAt}`);
      }

      try {
        switch (name) {
          case 'gmirror_score':
            return await this.handleScore(args as any);
          case 'gmirror_health':
            return await this.handleHealth();
          case 'gmirror_failure_modes':
          case 'gmirror_get_failure_modes':
            return await this.handleFailureModes();
          case 'gmirror_calibrate':
            return await this.handleCalibrate();
          case 'gmirror_get_receipts':
            return await this.handleGetReceipts(args as any);
          case 'gmirror_get_trend':
            return await this.handleGetTrend(args as any);
          case 'gmirror_get_drift':
            return await this.handleGetDrift(args as any);
          case 'gmirror_get_cost_stats':
            return await this.handleGetCostStats();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.errorResponse(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  /**
   * Generate a new authentication token
   */
  generateToken(customRoles?: string[]): AuthToken {
    const token = this.authMiddleware.getAuth().generateToken(customRoles);
    this.issuedTokens.set(token.token, {
      scopes: this.parseScopes(token.roles.join(',')),
      expiresAt: new Date(token.expiresAt).getTime(),
    });
    return token;
  }

  private authorize(meta: Record<string, unknown> | undefined, requiredScope: McpScope) {
    const authHeaderRaw = meta?.authorization;
    const authHeader = typeof authHeaderRaw === 'string' ? authHeaderRaw : '';

    if (!authHeader) {
      if (!this.requireAuth && requiredScope === 'read' && this.allowAnonymousRead) {
        return { ok: true as const, token: 'anonymous-read' };
      }
      return { ok: false as const, error: `Authentication failed: missing bearer token for ${requiredScope} scope` };
    }

    const auth = this.authMiddleware.authenticate(authHeader);
    if (!auth.success) {
      return { ok: false as const, error: `Authentication failed: ${auth.error}` };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const scopes = this.scopesForToken(token, auth.token?.roles || []);
    if (!scopes.includes(requiredScope)) {
      return { ok: false as const, error: `Insufficient permissions: requires ${requiredScope} scope` };
    }

    return { ok: true as const, token };
  }

  private scopesForToken(token: string, fallbackRoles: string[]): McpScope[] {
    const issued = this.issuedTokens.get(token);
    if (issued && issued.expiresAt >= Date.now()) {
      return this.permissions.scopesForToken(token, issued.scopes).filter((scope): scope is McpScope => scope === 'read' || scope === 'write');
    }
    if (this.bootstrapToken && token === this.bootstrapToken) {
      return this.permissions.scopesForToken(token, this.bootstrapScopes).filter((scope): scope is McpScope => scope === 'read' || scope === 'write');
    }
    if (this.bootstrapToken) {
      return [];
    }
    const fallback = this.parseScopes(fallbackRoles.join(','));
    return this.permissions.scopesForToken(token, fallback).filter((scope): scope is McpScope => scope === 'read' || scope === 'write');
  }

  private requiredScopeForTool(name: string): McpScope {
    const writeTools = new Set(['gmirror_score', 'gmirror_calibrate']);
    return writeTools.has(name) ? 'write' : 'read';
  }

  private checkRateLimit(token: string) {
    const now = Date.now();
    const minuteMs = 60 * 1000;
    const hourMs = 60 * 60 * 1000;
    let window = this.rateWindows.get(token);
    if (!window) {
      window = { minuteCount: 0, minuteStart: now, hourCount: 0, hourStart: now };
      this.rateWindows.set(token, window);
    }
    if (now - window.minuteStart >= minuteMs) {
      window.minuteStart = now;
      window.minuteCount = 0;
    }
    if (now - window.hourStart >= hourMs) {
      window.hourStart = now;
      window.hourCount = 0;
    }
    if (window.minuteCount >= this.rateLimitRpm || window.hourCount >= this.rateLimitRph) {
      const resetAt = new Date(Math.min(window.minuteStart + minuteMs, window.hourStart + hourMs)).toISOString();
      return { allowed: false, resetAt };
    }
    window.minuteCount++;
    window.hourCount++;
    return { allowed: true, resetAt: new Date(window.minuteStart + minuteMs).toISOString() };
  }

  private tokenLabel(token: string): string {
    return token === 'anonymous-read' ? token : `token:${this.authMiddleware.getAuth().hashToken(token)}`;
  }

  private parseScopes(value: string): McpScope[] {
    const scopes = value
      .split(',')
      .map(scope => scope.trim())
      .filter((scope): scope is McpScope => scope === 'read' || scope === 'write');
    return scopes.length > 0 ? scopes : ['read'];
  }

  private parseLimit(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private errorResponse(text: string) {
    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
      isError: true,
    };
  }

  private static readonly GetReceiptsArgsSchema = z.object({
    limit: z.number().int().positive().max(1000).optional(),
    offset: z.number().int().nonnegative().max(10000).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  });

  private static readonly GetDriftArgsSchema = z.object({
    metricName: z.string().optional(),
  });

  private static readonly GetTrendArgsSchema = z.object({
    windowDays: z.number().int().positive().max(365).optional(),
  });

  private static readonly ScoreArgsSchema = z.object({
    payload: z.any(),
    panelSize: z.number().int().positive().max(100).optional(),
    mode: z.string().optional(),
  });

  private async handleGetReceipts(args: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const parsed = GMirrorMCPServer.GetReceiptsArgsSchema.safeParse(args);
    if (!parsed.success) {
      return this.errorResponse(`Invalid request: ${JSON.stringify(parsed.error.flatten())}`);
    }
    const receipts = await this.gmirror.getReceipts(parsed.data);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(receipts, null, 2),
        },
      ],
    };
  }

  private async handleGetDrift(args: {
    metricName?: string;
  } = {}) {
    const parsed = GMirrorMCPServer.GetDriftArgsSchema.safeParse(args);
    if (!parsed.success) {
      return this.errorResponse(`Invalid request: ${JSON.stringify(parsed.error.flatten())}`);
    }
    const drift = await this.gmirror.getDrift(parsed.data.metricName);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(drift, null, 2),
        },
      ],
    };
  }

  private async handleGetTrend(args: {
    windowDays?: number;
  } = {}) {
    const parsed = GMirrorMCPServer.GetTrendArgsSchema.safeParse(args);
    if (!parsed.success) {
      return this.errorResponse(`Invalid request: ${JSON.stringify(parsed.error.flatten())}`);
    }
    const windowDays = parsed.data.windowDays || 7;
    const end = new Date();
    const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const receipts = await this.gmirror.getReceipts({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 1000,
    });
    const scores = receipts
      .map((receipt: any) => typeof receipt.overall_score === 'number' ? receipt.overall_score : undefined)
      .filter((score: number | undefined): score is number => typeof score === 'number');
    const midpoint = Math.max(1, Math.floor(scores.length / 2));
    const earlier = scores.slice(0, midpoint);
    const later = scores.slice(midpoint);
    const earlierAvg = this.average(earlier);
    const laterAvg = later.length > 0 ? this.average(later) : earlierAvg;
    const delta = laterAvg - earlierAvg;
    const trend = Math.abs(delta) < 0.01 ? 'stable' : delta > 0 ? 'improving' : 'degrading';

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            window_days: windowDays,
            receipts_analyzed: receipts.length,
            average_score: this.average(scores),
            earlier_average_score: earlierAvg,
            later_average_score: laterAvg,
            delta,
            trend,
          }, null, 2),
        },
      ],
    };
  }

  private average(values: number[]): number {
    return values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  }

  private async handleGetCostStats() {
    const stats = this.gmirror.getCostStats();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  private async handleScore(args: {
    payload: any;
    panelSize?: number;
    mode?: string;
  }) {
    const parsed = GMirrorMCPServer.ScoreArgsSchema.safeParse(args);
    if (!parsed.success) {
      return this.errorResponse(`Invalid request: ${JSON.stringify(parsed.error.flatten())}`);
    }
    const request = {
      request_id: crypto.randomUUID(),
      payload: parsed.data.payload,
      panel_size: parsed.data.panelSize || 5,
      mode: (parsed.data.mode || 'standard') as 'change' | 'pre_build' | 'shadow',
      context: {},
      budget: {
        max_cost_usd: 10,
        max_latency_ms: 60000,
        max_panel_size: parsed.data.panelSize || 10,
      },
      caller: {
        source: 'mcp',
        ref: 'claude_code',
      },
      created_at: new Date().toISOString(),
    };

    const scope = {
      request_id: request.request_id,
      population_filter: {
        persona_labels: [],
        expertise_domains: [],
        trust_range: [0, 1] as [number, number],
      },
      scenario_set: [],
      red_team_set: [],
      scoring_profile: 'default',
      panel_size: args.panelSize || 10,
    };

    const verdict = await this.gmirror.scoreChange(request, scope);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            overall: verdict.overall,
            correctness: verdict.scores.correctness.score.point,
            user_outcome: verdict.scores.user_outcome.score.point,
            robustness: verdict.scores.robustness.score.point,
            risk: verdict.scores.risk.score.point,
            confidence: verdict.scores.confidence.score.point,
            hard_gates: verdict.hard_gate_results,
            failure_modes_detected: verdict.failure_modes_detected.length,
            cost_usd: verdict.cost_breakdown.total_cost_usd,
            latency_ms: verdict.latency_ms,
          }, null, 2),
        },
      ],
    };
  }

  private async handleHealth() {
    const health = await this.gmirror.healthCheck();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(health, null, 2),
        },
      ],
    };
  }

  private async handleFailureModes() {
    const failureModes = this.gmirror.getFailureModes();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(failureModes, null, 2),
        },
      ],
    };
  }

  private async handleCalibrate() {
    await this.gmirror.calibratePopulation();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ status: 'calibrated' }, null, 2),
        },
      ],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('GMirror MCP Server started');
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new GMirrorMCPServer();
  server.start().catch((error) => logger.error('GMirror MCP Server failed', {
    error: error instanceof Error ? error.message : String(error),
  }));
}

export { GMirrorMCPServer };
