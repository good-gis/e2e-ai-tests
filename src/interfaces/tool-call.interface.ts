export interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
}