import {TestStep} from "./test-step.interface.js";

export interface TestResult {
    name: string;
    filePath: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    steps: TestStep[];
    error?: string;
    screenshots: string[];
}