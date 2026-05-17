/**
 * Tool Registry
 * 
 * Dynamic tool loading and registry system for g-stack tools.
 * Supports plugin-based architecture with lazy loading.
 */

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  execute: (input: any) => Promise<any>;
  validate?: (input: any) => boolean;
  schema?: any;
  permissions?: string[];
  enabled?: boolean;
}

export interface ToolLoadResult {
  tool: ToolDefinition;
  loaded: boolean;
  error?: string;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition>;
  private toolPaths: Map<string, string>;
  private loadedTools: Set<string>;

  constructor() {
    this.tools = new Map();
    this.toolPaths = new Map();
    this.loadedTools = new Set();
  }

  /**
   * Register a tool
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
    this.loadedTools.add(tool.id);
  }

  /**
   * Unregister a tool
   */
  unregister(toolId: string): void {
    this.tools.delete(toolId);
    this.loadedTools.delete(toolId);
    this.toolPaths.delete(toolId);
  }

  /**
   * Get a tool by ID
   */
  get(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Check if a tool is registered
   */
  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Check if a tool is loaded
   */
  isLoaded(toolId: string): boolean {
    return this.loadedTools.has(toolId);
  }

  /**
   * List all registered tools
   */
  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * List tools by category
   */
  listByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }

  /**
   * List enabled tools
   */
  listEnabled(): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => tool.enabled !== false);
  }

  /**
   * Load a tool from a file path
   */
  async loadTool(toolId: string, path: string): Promise<ToolLoadResult> {
    try {
      this.toolPaths.set(toolId, path);
      
      // Dynamic import of tool module
      const module = await import(path);
      const tool: ToolDefinition = module.default || module;
      
      if (!tool.id || !tool.execute) {
        throw new Error('Invalid tool definition');
      }
      
      this.register(tool);
      
      return {
        tool,
        loaded: true,
      };
    } catch (error) {
      return {
        tool: { id: toolId, name: toolId, description: '', version: '0.0.0', category: 'unknown', execute: async () => {} },
        loaded: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Load multiple tools from a directory
   */
  async loadToolsFromDirectory(directory: string): Promise<ToolLoadResult[]> {
    const results: ToolLoadResult[] = [];
    
    // In a real implementation, this would scan the directory and load all tools
    // For now, this is a placeholder
    return results;
  }

  /**
   * Execute a tool
   */
  async execute(toolId: string, input: any): Promise<any> {
    const tool = this.tools.get(toolId);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }
    
    if (tool.enabled === false) {
      throw new Error(`Tool is disabled: ${toolId}`);
    }
    
    if (tool.validate && !tool.validate(input)) {
      throw new Error(`Invalid input for tool: ${toolId}`);
    }
    
    return await tool.execute(input);
  }

  /**
   * Validate tool input
   */
  validateInput(toolId: string, input: any): boolean {
    const tool = this.tools.get(toolId);
    
    if (!tool) {
      return false;
    }
    
    if (!tool.validate) {
      return true;
    }
    
    return tool.validate(input);
  }

  /**
   * Enable a tool
   */
  enable(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      tool.enabled = true;
    }
  }

  /**
   * Disable a tool
   */
  disable(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      tool.enabled = false;
    }
  }

  /**
   * Get tool statistics
   */
  getStats(): {
    total: number;
    loaded: number;
    enabled: number;
    disabled: number;
    byCategory: Record<string, number>;
  } {
    const tools = Array.from(this.tools.values());
    const byCategory: Record<string, number> = {};
    
    for (const tool of tools) {
      byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
    }
    
    return {
      total: tools.length,
      loaded: this.loadedTools.size,
      enabled: tools.filter(t => t.enabled !== false).length,
      disabled: tools.filter(t => t.enabled === false).length,
      byCategory,
    };
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
    this.toolPaths.clear();
    this.loadedTools.clear();
  }
}

/**
 * Global tool registry instance
 */
let globalToolRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!globalToolRegistry) {
    globalToolRegistry = new ToolRegistry();
  }
  return globalToolRegistry;
}

export function resetToolRegistry(): void {
  globalToolRegistry = null;
}

/**
 * Built-in tool definitions
 */
export const BuiltinTools: ToolDefinition[] = [
  {
    id: 'file-read',
    name: 'File Read',
    description: 'Read the contents of a file',
    version: '1.0.0',
    category: 'filesystem',
    execute: async (input: { path: string }) => {
      // Implementation would read file
      return { content: '' };
    },
    validate: (input: any) => input && typeof input.path === 'string',
  },
  {
    id: 'file-write',
    name: 'File Write',
    description: 'Write content to a file',
    version: '1.0.0',
    category: 'filesystem',
    execute: async (input: { path: string; content: string }) => {
      // Implementation would write file
      return { success: true };
    },
    validate: (input: any) => input && typeof input.path === 'string' && typeof input.content === 'string',
  },
  {
    id: 'shell-exec',
    name: 'Shell Execute',
    description: 'Execute a shell command',
    version: '1.0.0',
    category: 'shell',
    execute: async (input: { command: string }) => {
      // Implementation would execute command
      return { stdout: '', stderr: '', exitCode: 0 };
    },
    validate: (input: any) => input && typeof input.command === 'string',
    permissions: ['shell-exec'],
  },
  {
    id: 'http-get',
    name: 'HTTP GET',
    description: 'Make an HTTP GET request',
    version: '1.0.0',
    category: 'network',
    execute: async (input: { url: string }) => {
      // Implementation would make HTTP request
      return { status: 200, body: '' };
    },
    validate: (input: any) => input && typeof input.url === 'string',
  },
];

/**
 * Register built-in tools
 */
export function registerBuiltinTools(registry: ToolRegistry): void {
  for (const tool of BuiltinTools) {
    registry.register(tool);
  }
}
