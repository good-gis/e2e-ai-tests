import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Config } from './interfaces/config.interface.js';

const DEFAULT_CONFIG: Config = {
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: '',
  },
  browser: {
    headless: true,
    viewport: {
      width: 1280,
      height: 720,
    },
  },
  execution: {
    maxStepsPerTest: 50,
    retryAttempts: 3,
    timeout: 30000,
  },
  tests: {
    pattern: 'tests/**/*.md',
  },
  debug: {
    screenshots: 'on-failure',
    logSteps: true,
    headed: false,
  },
  history: {
    enabled: true,
    directory: '.e2e-results',
  },
};

export async function loadConfig(configPath?: string): Promise<Config> {
  const possiblePaths = configPath
    ? [configPath]
    : [
        'e2e.config.json',
        'e2e-ai.config.json',
      ];

  let configFile: string | null = null;

  for (const path of possiblePaths) {
    const fullPath = join(process.cwd(), path);
    if (existsSync(fullPath)) {
      configFile = fullPath;
      break;
    }
  }

  let userConfig: Partial<Config> = {};

  if (configFile) {
    try {
      const content = await readFile(configFile, 'utf-8');
      userConfig = JSON.parse(content) as Partial<Config>;
    } catch (error) {
      throw new Error(`Failed to parse config file ${configFile}: ${error}`);
    }
  }

  // Merge with defaults
  const config: Config = {
    llm: {
      ...DEFAULT_CONFIG.llm,
      ...userConfig.llm,
    },
    browser: {
      ...DEFAULT_CONFIG.browser,
      ...userConfig.browser,
      viewport: {
        ...DEFAULT_CONFIG.browser.viewport,
        ...userConfig.browser?.viewport,
      },
    },
    execution: {
      ...DEFAULT_CONFIG.execution,
      ...userConfig.execution,
    },
    tests: {
      ...DEFAULT_CONFIG.tests,
      ...userConfig.tests,
    },
    debug: {
      ...DEFAULT_CONFIG.debug,
      ...userConfig.debug,
    },
    history: {
      ...DEFAULT_CONFIG.history,
      ...userConfig.history,
    },
  };

  // Resolve environment variables
  config.llm.apiKey = config.llm.apiKey || process.env.ANTHROPIC_API_KEY || '';

  // Apply environment overrides
  if (process.env.E2E_HEADED === 'true') {
    config.debug.headed = true;
    config.browser.headless = false;
  }

  if (process.env.E2E_DEBUG === 'true') {
    config.debug.logSteps = true;
    config.debug.screenshots = 'always';
  }

  // Validate
  if (!config.llm.apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  return config;
}

export function applyCliOptions(
  config: Config,
  options: {
    headed?: boolean;
    debug?: boolean;
    pattern?: string;
  }
): Config {
  const result: Config = {
    ...config,
    browser: { ...config.browser },
    debug: { ...config.debug },
    tests: { ...config.tests },
  };

  if (options.headed) {
    result.debug.headed = true;
    result.browser.headless = false;
  }

  if (options.debug) {
    result.debug.logSteps = true;
    result.debug.screenshots = 'always';
  }

  if (options.pattern) {
    result.tests.pattern = options.pattern;
  }

  return result;
}
