# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

E2E testing framework that uses LLM (Claude) to execute browser tests written in natural language JSON format. The LLM interprets test steps and interacts with the browser via Playwright MCP (Model Context Protocol).

## Commands

```bash
# Build
npm run build

# Run all tests
npm run start run

# Run specific test file
npm run start run tests/todo-add.json

# Run with visible browser
npm run start run --headed

# Run with debug logging
npm run start run --debug

# Development (build + run)
npm run dev
```

## Architecture

```
CLI (cli.ts)
    ↓
TestRunner (runner.ts) — orchestrates test execution
    ├── Parser (parser.ts) — loads JSON test files
    ├── LLMAdapter (llm-adapter.ts) — Claude API communication
    ├── MCPClient (mcp-client.ts) — Playwright browser control via MCP
    └── Reporter (reporter.ts) — console output and history
```

**Flow:**
1. `TestRunner` loads test JSON via `Parser`
2. `MCPClient` spawns `@playwright/mcp` subprocess for browser control
3. `LLMAdapter` sends test instructions to Claude with available browser tools
4. Claude returns tool calls (navigate, click, type, etc.)
5. `MCPClient` executes tool calls via MCP protocol
6. Loop continues until Claude declares PASS/FAIL

**Key behavior:**
- Test status defaults to `failed` — requires explicit "TEST PASSED" or "ТЕСТ ПРОЙДЕН" from LLM
- LLM must verify each `expectedResults` entry against actual page state before passing

## Test File Format

```json
{
  "name": "Test name",
  "description": "Optional description",
  "url": "https://example.com",
  "steps": [
    "Natural language step 1",
    "Natural language step 2"
  ],
  "expectedResults": [
    "Expected outcome 1",
    "Expected outcome 2"
  ],
  "cleanup": {
    "localStorage": true,
    "sessionStorage": true
  }
}
```

## Configuration

Config file: `e2e.config.json` (optional)

Environment variable: `ANTHROPIC_API_KEY` — required for LLM access

Default test pattern: `tests/**/*.json`
