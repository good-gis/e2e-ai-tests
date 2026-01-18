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