export interface CleanupOptions {
    cookies?: boolean;
    localStorage?: boolean;
    sessionStorage?: boolean;
}

export interface TestJson {
    name: string;
    description?: string;
    url: string;
    steps: string[];
    expectedResults: string[];
    preconditions?: string[];
    cleanup?: CleanupOptions;
}