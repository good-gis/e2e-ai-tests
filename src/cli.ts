#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, applyCliOptions } from './config.js';
import { TestRunner } from './runner.js';

const program = new Command();

program
  .name('e2e-ai-tests')
  .description('E2E testing framework powered by LLM')
  .version('0.1.0');

program
  .command('run')
  .description('Run E2E tests')
  .argument('[pattern]', 'Test file pattern (e.g., tests/*.md)')
  .option('--headed', 'Run with visible browser')
  .option('--debug', 'Enable debug mode with verbose logging')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (pattern, options) => {
    try {
      const baseConfig = await loadConfig(options.config);
      const config = applyCliOptions(baseConfig, {
        headed: options.headed,
        debug: options.debug,
        pattern,
      });

      const runner = new TestRunner(config);
      const result = await runner.run(pattern);

      // Exit with appropriate code
      process.exit(result.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(2);
    }
  });

program.parse();
