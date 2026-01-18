export interface TestJson {
    name: string;
    description?: string;
    url: string;
    steps: string[];
    expectedResults: string[];
    preconditions?: string[];
}