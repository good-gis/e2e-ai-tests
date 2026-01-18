import {ToolCall} from "./tool-call.interface.js";


export interface LLMResult {
    content: string;
    toolCalls: ToolCall[];
    stopReason: string;
}
