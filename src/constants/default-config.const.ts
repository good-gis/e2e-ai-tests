import type {Config} from "../interfaces/config.interface.js";

export const DEFAULT_CONFIG: Config = {
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
        pattern: 'tests/**/*.json',
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
