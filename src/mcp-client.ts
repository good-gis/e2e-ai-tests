import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import type {Config} from './interfaces/config.interface.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: MCPTool[] = [];
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const args = ['@playwright/mcp@latest'];

    if (this.config.browser.headless) {
      args.push('--headless');
    }

    args.push('--viewport-size', `${this.config.browser.viewport.width}x${this.config.browser.viewport.height}`);

    this.transport = new StdioClientTransport({
      command: 'npx',
      args,
    });

    this.client = new Client({
      name: 'e2e-ai-tests',
      version: '0.1.0',
    }, {
      capabilities: {},
    });

    await this.client.connect(this.transport);

    // Get available tools
    const toolsResponse = await this.client.listTools();
    this.tools = toolsResponse.tools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  getToolsForLLM(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    return await this.client.callTool({
      name,
      arguments: args,
    });
  }

  async navigate(url: string): Promise<unknown> {
    return this.callTool('browser_navigate', { url });
  }

  async click(element: string, ref: number): Promise<unknown> {
    return this.callTool('browser_click', { element, ref });
  }

  async type(element: string, ref: number, text: string): Promise<unknown> {
    return this.callTool('browser_type', { element, ref, text });
  }

  async screenshot(): Promise<string | null> {
    const result = await this.callTool('browser_take_screenshot', {}) as {
      content?: Array<{ type: string; data?: string }>;
    };

    if (result.content && result.content[0]?.type === 'image') {
      return result.content[0].data || null;
    }
    return null;
  }

  async getSnapshot(): Promise<string> {
    const result = await this.callTool('browser_snapshot', {}) as {
      content?: Array<{ type: string; text?: string }>;
    };

    if (result.content && result.content[0]?.text) {
      return result.content[0].text;
    }
    return '';
  }

  async pressKey(key: string): Promise<unknown> {
    return this.callTool('browser_press_key', { key });
  }

  async hover(element: string, ref: number): Promise<unknown> {
    return this.callTool('browser_hover', { element, ref });
  }

  async selectOption(element: string, ref: number, values: string[]): Promise<unknown> {
    return this.callTool('browser_select_option', { element, ref, values });
  }
}
