import Anthropic from '@anthropic-ai/sdk';
import type { Config } from './interfaces/config.interface.js';
import type { ParsedTest } from './interfaces/parsed-test.interface.js';
import type { MCPTool } from './mcp-client.js';

const SYSTEM_PROMPT = `You are an E2E test executor. Your task is to perform actions on web pages based on natural language instructions.

You have access to browser automation tools via @playwright/mcp. For each step:
1. First use browser_snapshot to see the current page state
2. Identify the target element using the ref number from the snapshot
3. Perform the required action using the appropriate tool
4. Report what you did

AVAILABLE TOOLS:
- browser_navigate: Navigate to a URL. Args: { url: string }
- browser_click: Click an element. Args: { element: string, ref: number }
- browser_type: Type text into an element. Args: { element: string, ref: number, text: string, submit?: boolean }
- browser_press_key: Press a key. Args: { key: string } (e.g., "Enter", "Tab", "Escape")
- browser_snapshot: Get page accessibility snapshot to see current state
- browser_take_screenshot: Take a screenshot
- browser_hover: Hover over an element. Args: { element: string, ref: number }
- browser_select_option: Select option from dropdown. Args: { element: string, ref: number, values: string[] }
- browser_fill_form: Fill form fields. Args: { fields: { selector: string, value: string }[] }

ELEMENT SELECTION:
When you call browser_snapshot, you will receive a structured representation of the page with ref numbers.
Use the "ref" parameter to identify elements by their reference number from the snapshot.
The "element" parameter is a description for logging purposes.

WORKFLOW:
1. Call browser_navigate to go to the target URL
2. Call browser_snapshot to see the page structure
3. Find the element you need by its ref number in the snapshot
4. Perform actions using the ref number
5. After actions, call browser_snapshot again to verify the result

When you complete all steps, analyze the final page state and determine if the expected results are met.
Respond with PASS or FAIL and explain your reasoning.

Respond in the same language as the test instructions (Russian or English).`;

export interface Message {
  role: 'user' | 'assistant';
  content: string | Array<Anthropic.ContentBlock>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMResult {
  content: string;
  toolCalls: ToolCall[];
  stopReason: string;
}

export class LLMAdapter {
  private client: Anthropic;
  private config: Config;
  private conversationHistory: Message[] = [];

  constructor(config: Config) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.llm.apiKey,
    });
  }

  resetConversation(): void {
    this.conversationHistory = [];
  }

  async chat(
    userMessage: string,
    tools: MCPTool[],
    imageBase64?: string
  ): Promise<LLMResult> {
    // Build user content
    const userContent: Anthropic.ContentBlockParam[] = [];

    if (imageBase64) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: imageBase64,
        },
      });
    }

    userContent.push({
      type: 'text',
      text: userMessage,
    });

    this.conversationHistory.push({
      role: 'user',
      content: userContent as unknown as Anthropic.ContentBlock[],
    });

    // Convert MCP tools to Anthropic format
    const anthropicTools: Anthropic.Tool[] = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    }));

    const response = await this.client.messages.create({
      model: this.config.llm.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: anthropicTools,
      messages: this.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content as Anthropic.ContentBlockParam[],
      })),
    });

    // Extract text and tool calls from response
    let textContent = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return {
      content: textContent,
      toolCalls,
      stopReason: response.stop_reason || 'end_turn',
    };
  }

  async sendToolResult(toolCallId: string, result: unknown): Promise<LLMResult> {
    // Add tool result to conversation
    const toolResultContent: Anthropic.ToolResultBlockParam = {
      type: 'tool_result',
      tool_use_id: toolCallId,
      content: typeof result === 'string' ? result : JSON.stringify(result),
    };

    this.conversationHistory.push({
      role: 'user',
      content: [toolResultContent] as unknown as Anthropic.ContentBlock[],
    });

    // Get MCP tools from conversation context (we need to pass them again)
    // For simplicity, we'll make another request without tools if there are no more tool calls needed
    const response = await this.client.messages.create({
      model: this.config.llm.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: this.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content as Anthropic.ContentBlockParam[],
      })),
    });

    let textContent = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return {
      content: textContent,
      toolCalls,
      stopReason: response.stop_reason || 'end_turn',
    };
  }

  async sendToolResults(
    results: Array<{ toolCallId: string; result: unknown }>,
    tools: MCPTool[]
  ): Promise<LLMResult> {
    // Add all tool results to conversation
    const toolResultContent: Anthropic.ToolResultBlockParam[] = results.map(r => ({
      type: 'tool_result' as const,
      tool_use_id: r.toolCallId,
      content: typeof r.result === 'string' ? r.result : JSON.stringify(r.result),
    }));

    this.conversationHistory.push({
      role: 'user',
      content: toolResultContent as unknown as Anthropic.ContentBlock[],
    });

    const anthropicTools: Anthropic.Tool[] = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    }));

    const response = await this.client.messages.create({
      model: this.config.llm.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: anthropicTools,
      messages: this.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content as Anthropic.ContentBlockParam[],
      })),
    });

    let textContent = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return {
      content: textContent,
      toolCalls,
      stopReason: response.stop_reason || 'end_turn',
    };
  }

  buildTestPrompt(test: ParsedTest, pageState: string): string {
    return `Execute the following E2E test:

**Test:** ${test.name}
${test.description ? `**Description:** ${test.description}` : ''}

**URL:** ${test.url}

**Steps to execute:**
${test.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**Expected results to verify:**
${test.expectedResults.map(r => `- ${r}`).join('\n')}

**Current page state:**
${pageState}

Start by navigating to the URL, then execute each step. After completing all steps, verify the expected results and report whether the test passed or failed.`;
  }

  buildVerificationPrompt(test: ParsedTest, pageState: string): string {
    return `Now verify the expected results for the test "${test.name}".

**Expected results:**
${test.expectedResults.map(r => `- ${r}`).join('\n')}

**Current page state:**
${pageState}

Analyze the page state and determine if ALL expected results are satisfied.

Respond with:
- PASS if all expected results are satisfied
- FAIL if any expected result is not satisfied

Explain your reasoning for each expected result.`;
  }
}
