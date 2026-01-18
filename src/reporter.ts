import chalk from 'chalk';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Config } from './interfaces/config.interface.js';
import type { TestResult } from './interfaces/test-result.interface.js';
import type { TestStep } from './interfaces/test-step.interface.js';
import type { RunResult } from './interfaces/run-result.interface.js';

export class Reporter {
  private config: Config;
  private startTime: number = 0;

  constructor(config: Config) {
    this.config = config;
  }

  startRun(totalTests: number): void {
    this.startTime = Date.now();
    console.log(chalk.bold.cyan('\ne2e-ai-tests v0.1.0\n'));
    console.log(chalk.gray(`Running ${totalTests} test(s)...\n`));
  }

  startTest(testName: string, filePath: string): void {
    if (this.config.debug.logSteps) {
      console.log(chalk.yellow(`\n▶ ${testName}`));
      console.log(chalk.gray(`  ${filePath}`));
    }
  }

  logStep(step: TestStep): void {
    if (!this.config.debug.logSteps) return;

    const prefix = '  ├─';
    const status = step.status === 'passed'
      ? chalk.green('✓')
      : step.status === 'failed'
        ? chalk.red('✗')
        : chalk.yellow('○');

    console.log(`${prefix} ${status} ${step.description}`);

    if (step.error) {
      console.log(chalk.red(`  │  ${step.error}`));
    }
  }

  logLLMThinking(message: string): void {
    if (!this.config.debug.logSteps) return;
    console.log(chalk.gray(`  │  [LLM] ${message}`));
  }

  logToolCall(toolName: string, args: Record<string, unknown>): void {
    if (!this.config.debug.logSteps) return;
    const argsStr = Object.entries(args)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    console.log(chalk.blue(`  │  [Tool] ${toolName}(${argsStr})`));
  }

  endTest(result: TestResult): void {
    const icon = result.status === 'passed'
      ? chalk.green('✓')
      : result.status === 'failed'
        ? chalk.red('✗')
        : chalk.yellow('○');

    const duration = `(${(result.duration / 1000).toFixed(1)}s)`;
    const name = result.status === 'passed'
      ? chalk.green(result.name)
      : result.status === 'failed'
        ? chalk.red(result.name)
        : chalk.yellow(result.name);

    if (this.config.debug.logSteps) {
      console.log(`  └─ ${icon} ${result.status.toUpperCase()} ${duration}`);
      if (result.error) {
        console.log(chalk.red(`\n     Error: ${result.error}\n`));
      }
    } else {
      console.log(`${icon} ${name} ${chalk.gray(duration)}`);
      if (result.error) {
        console.log(chalk.red(`  Error: ${result.error}`));
      }
    }
  }

  endRun(results: RunResult): void {
    const duration = (Date.now() - this.startTime) / 1000;

    console.log(chalk.bold('\n─────────────────────────────────────\n'));

    const passedText = results.passed > 0
      ? chalk.green(`${results.passed} passed`)
      : '0 passed';

    const failedText = results.failed > 0
      ? chalk.red(`${results.failed} failed`)
      : '0 failed';

    const skippedText = results.skipped > 0
      ? chalk.yellow(`${results.skipped} skipped`)
      : '';

    const parts = [passedText, failedText];
    if (skippedText) parts.push(skippedText);

    console.log(`Tests: ${parts.join(', ')}`);
    console.log(`Time: ${duration.toFixed(1)}s`);
    console.log();
  }

  async saveHistory(results: RunResult): Promise<string | null> {
    if (!this.config.history.enabled) return null;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const historyDir = join(this.config.history.directory, timestamp);

    await mkdir(historyDir, { recursive: true });

    const resultsPath = join(historyDir, 'results.json');
    await writeFile(resultsPath, JSON.stringify(results, null, 2));

    // Create screenshots directory if there are screenshots
    const hasScreenshots = results.tests.some(t => t.screenshots.length > 0);
    if (hasScreenshots) {
      const screenshotsDir = join(historyDir, 'screenshots');
      await mkdir(screenshotsDir, { recursive: true });
    }

    return historyDir;
  }

  logScreenshotSaved(path: string): void {
    if (this.config.debug.logSteps) {
      console.log(chalk.gray(`  │  Screenshot saved: ${path}`));
    }
  }

  logError(message: string): void {
    console.log(chalk.red(`\nError: ${message}\n`));
  }

  logInfo(message: string): void {
    console.log(chalk.cyan(message));
  }
}
