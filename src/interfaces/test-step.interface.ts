export interface TestStep {
    index: number;
    description: string;
    status: 'pending' | 'running' | 'passed' | 'failed';
    error?: string;
    screenshot?: string;
}