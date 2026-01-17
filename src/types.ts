export interface Config {
  llm: {
    provider: 'anthropic' | 'openai';
    model: string;
    apiKey: string;
  };
  browser: {
    headless: boolean;
    viewport: {
      width: number;
      height: number;
    };
  };
  execution: {
    maxStepsPerTest: number;
    retryAttempts: number;
    timeout: number;
  };
  tests: {
    pattern: string;
  };
  debug: {
    screenshots: 'on-failure' | 'always' | 'never';
    logSteps: boolean;
    headed: boolean;
  };
  history: {
    enabled: boolean;
    directory: string;
  };
}

export interface ParsedTest {
  name: string;
  description?: string;
  url: string;
  steps: string[];
  expectedResults: string[];
  preconditions?: string[];
  filePath: string;
}

export interface TestStep {
  index: number;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  error?: string;
  screenshot?: string;
}

export interface TestResult {
  name: string;
  filePath: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  steps: TestStep[];
  error?: string;
  screenshots: string[];
}

export interface RunResult {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestResult[];
}

export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'wait' | 'press';
  selector?: string;
  value?: string;
  url?: string;
}

export interface LLMResponse {
  thinking?: string;
  action?: BrowserAction;
  assertion?: {
    passed: boolean;
    reason: string;
  };
  done?: boolean;
  error?: string;
}
