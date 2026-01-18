import {TestResult} from "./test-result.interface.js";

export interface RunResult {
    timestamp: string;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    tests: TestResult[];
}
