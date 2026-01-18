import Anthropic from "@anthropic-ai/sdk";

export interface Message {
    role: 'user' | 'assistant';
    content: string | Array<Anthropic.ContentBlock>;
}
