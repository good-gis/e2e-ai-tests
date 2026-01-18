import {CleanupOptions} from "./test-json.interface.js";

export interface ParsedTest {
    name: string;
    description?: string;
    url: string;
    steps: string[];
    expectedResults: string[];
    preconditions?: string[];
    filePath: string;
    cleanup?: CleanupOptions;
}