import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import type {Config} from './interfaces/config.interface.js';
import {MCPTool} from "./interfaces/mcp-tool.interface.js";

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

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    return await this.client.callTool({
      name,
      arguments: args,
    });
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
}
