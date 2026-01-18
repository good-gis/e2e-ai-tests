import { glob } from 'glob';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { ParsedTest } from './interfaces/parsed-test.interface.js';
import type { Config } from './interfaces/config.interface.js';
import type { TestResult } from './interfaces/test-result.interface.js';
import type { TestStep } from './interfaces/test-step.interface.js';
import type { RunResult } from './interfaces/run-result.interface.js';
import { parseTestFile } from './parser.js';
import { MCPClient } from './mcp-client.js';
import { LLMAdapter } from './llm-adapter.js';
import { Reporter } from './reporter.js';

export class TestRunner {
  private config: Config;
  private mcpClient: MCPClient;
  private llmAdapter: LLMAdapter;
  private reporter: Reporter;

  constructor(config: Config) {
    this.config = config;
    this.mcpClient = new MCPClient(config);
    this.llmAdapter = new LLMAdapter(config);
    this.reporter = new Reporter(config);
  }

  async run(pattern?: string): Promise<RunResult> {
    const testPattern = pattern || this.config.tests.pattern;
    const testFiles = await glob(testPattern);

    if (testFiles.length === 0) {
      this.reporter.logError(`No test files found matching pattern: ${testPattern}`);
      return this.createEmptyResult();
    }

    // Parse all test files
    const tests: ParsedTest[] = [];
    for (const file of testFiles) {
      try {
        const test = await parseTestFile(file);
        tests.push(test);
      } catch (error) {
        this.reporter.logError(`Failed to parse ${file}: ${error}`);
      }
    }

    if (tests.length === 0) {
      this.reporter.logError('No valid tests found');
      return this.createEmptyResult();
    }

    this.reporter.startRun(tests.length);

    // Connect to MCP
    try {
      this.reporter.logInfo('Connecting to browser...');
      await this.mcpClient.connect();
    } catch (error) {
      this.reporter.logError(`Failed to connect to browser: ${error}`);
      return this.createEmptyResult();
    }

    const results: TestResult[] = [];
    const startTime = Date.now();

    // Run tests sequentially
    for (const test of tests) {
      const result = await this.runTest(test);
      results.push(result);
    }

    // Disconnect from MCP
    await this.mcpClient.disconnect();

    const runResult: RunResult = {
      timestamp: new Date().toISOString(),
      totalTests: tests.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      duration: Date.now() - startTime,
      tests: results,
    };

    this.reporter.endRun(runResult);

    // Save history
    if (this.config.history.enabled) {
      const historyPath = await this.reporter.saveHistory(runResult);
      if (historyPath) {
        this.reporter.logInfo(`Results saved to: ${historyPath}`);
      }
    }

    return runResult;
  }

  private async runTest(test: ParsedTest): Promise<TestResult> {
    const startTime = Date.now();
    const steps: TestStep[] = [];
    const screenshots: string[] = [];
    let error: string | undefined;
    let status: 'passed' | 'failed' | 'skipped' = 'passed';

    this.reporter.startTest(test.name, test.filePath);
    this.llmAdapter.resetConversation();

    try {
      // Get initial page state (empty before navigation)
      const tools = this.mcpClient.getTools();

      // Build initial prompt
      const initialPrompt = this.llmAdapter.buildTestPrompt(test, 'Page not loaded yet. Start by navigating to the URL.');

      // Start conversation with LLM
      let response = await this.llmAdapter.chat(initialPrompt, tools);
      let stepCount = 0;
      const maxSteps = this.config.execution.maxStepsPerTest;

      // Agent loop
      while (stepCount < maxSteps) {
        stepCount++;

        // Log LLM response
        if (response.content) {
          this.reporter.logLLMThinking(response.content.slice(0, 200));
        }

        // Check if LLM wants to use tools
        if (response.toolCalls.length === 0) {
          // No more tool calls - LLM is done
          // Check if the response indicates pass or fail
          const responseText = response.content.toLowerCase();
          if (responseText.includes('pass') || responseText.includes('passed') ||
              responseText.includes('успешно') || responseText.includes('пройден')) {
            status = 'passed';
          } else if (responseText.includes('fail') || responseText.includes('failed') ||
                     responseText.includes('провал') || responseText.includes('не удалось')) {
            status = 'failed';
            error = response.content;
          }
          break;
        }

        // Execute tool calls
        const toolResults: Array<{ toolCallId: string; result: unknown }> = [];

        for (const toolCall of response.toolCalls) {
          this.reporter.logToolCall(toolCall.name, toolCall.input);

          // Create step for this action
          const step: TestStep = {
            index: steps.length + 1,
            description: this.describeToolCall(toolCall.name, toolCall.input),
            status: 'running',
          };
          steps.push(step);

          try {
            const result = await this.mcpClient.callTool(toolCall.name, toolCall.input);
            toolResults.push({ toolCallId: toolCall.id, result });
            step.status = 'passed';

            // Take screenshot on failure or if debug mode
            if (toolCall.name === 'playwright_screenshot') {
              const screenshotData = result as { content?: Array<{ data?: string }> };
              if (screenshotData.content?.[0]?.data) {
                const screenshotPath = await this.saveScreenshot(
                  screenshotData.content[0].data,
                  test.name,
                  steps.length
                );
                screenshots.push(screenshotPath);
                step.screenshot = screenshotPath;
              }
            }
          } catch (err) {
            step.status = 'failed';
            step.error = String(err);
            toolResults.push({ toolCallId: toolCall.id, result: `Error: ${err}` });

            // Take screenshot on error
            if (this.config.debug.screenshots !== 'never') {
              try {
                const screenshotData = await this.mcpClient.screenshot();
                if (screenshotData) {
                  const screenshotPath = await this.saveScreenshot(
                    screenshotData,
                    test.name,
                    steps.length
                  );
                  screenshots.push(screenshotPath);
                  step.screenshot = screenshotPath;
                  this.reporter.logScreenshotSaved(screenshotPath);
                }
              } catch {
                // Ignore screenshot errors
              }
            }
          }

          this.reporter.logStep(step);
        }

        // Send tool results back to LLM
        response = await this.llmAdapter.sendToolResults(toolResults, tools);

        // Check if we hit tool_use stop reason - LLM wants to call more tools
        if (response.stopReason !== 'tool_use' && response.toolCalls.length === 0) {
          // LLM finished
          const responseText = response.content.toLowerCase();
          if (responseText.includes('pass') || responseText.includes('passed') ||
              responseText.includes('успешно') || responseText.includes('пройден')) {
            status = 'passed';
          } else if (responseText.includes('fail') || responseText.includes('failed') ||
                     responseText.includes('провал') || responseText.includes('не удалось')) {
            status = 'failed';
            error = response.content;
          }
          break;
        }
      }

      if (stepCount >= maxSteps) {
        status = 'failed';
        error = `Test exceeded maximum steps limit (${maxSteps})`;
      }

    } catch (err) {
      status = 'failed';
      error = String(err);

      // Take screenshot on error
      if (this.config.debug.screenshots !== 'never') {
        try {
          const screenshotData = await this.mcpClient.screenshot();
          if (screenshotData) {
            const screenshotPath = await this.saveScreenshot(
              screenshotData,
              test.name,
              steps.length
            );
            screenshots.push(screenshotPath);
            this.reporter.logScreenshotSaved(screenshotPath);
          }
        } catch {
          // Ignore screenshot errors
        }
      }
    }

    // Cleanup browser data if requested
    if (test.cleanup) {
      try {
        await this.mcpClient.cleanup(test.cleanup);
        this.reporter.logInfo('Browser data cleaned up');
      } catch (err) {
        this.reporter.logError(`Cleanup failed: ${err}`);
      }
    }

    const result: TestResult = {
      name: test.name,
      filePath: test.filePath,
      status,
      duration: Date.now() - startTime,
      steps,
      error,
      screenshots,
    };

    this.reporter.endTest(result);
    return result;
  }

  private describeToolCall(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'browser_navigate':
        return `Navigate to ${input.url}`;
      case 'browser_click':
        return `Click on "${input.element || input.ref}"`;
      case 'browser_type':
        return `Type "${input.text}" into "${input.element || input.ref}"`;
      case 'browser_press_key':
        return `Press ${input.key}`;
      case 'browser_take_screenshot':
        return 'Take screenshot';
      case 'browser_snapshot':
        return 'Get page snapshot';
      case 'browser_hover':
        return `Hover over "${input.element || input.ref}"`;
      case 'browser_select_option':
        return `Select "${input.values}" in "${input.element || input.ref}"`;
      case 'browser_fill_form':
        return 'Fill form fields';
      default:
        return `${name}(${JSON.stringify(input)})`;
    }
  }

  private async saveScreenshot(base64Data: string, testName: string, stepIndex: number): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = testName.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 50);
    const fileName = `${safeName}-step${stepIndex}-${timestamp}.png`;
    const screenshotDir = join(this.config.history.directory, 'screenshots');

    await mkdir(screenshotDir, { recursive: true });
    const filePath = join(screenshotDir, fileName);

    await writeFile(filePath, Buffer.from(base64Data, 'base64'));
    return filePath;
  }

  private createEmptyResult(): RunResult {
    return {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
    };
  }
}
