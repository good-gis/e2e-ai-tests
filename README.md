# 🤖 E2E AI Tests

Welcome to the AI-powered E2E testing framework! Write tests in natural language JSON format, and let Claude AI execute them in the browser. 🚀

[Смотреть demo](https://github.com/good-gis/e2e-ai-tests/blob/main/public/demo.mov)

## 🌟 Features

- 📝 **Natural Language Tests**: Write test steps in plain Russian or English.
- 🧠 **AI-Powered Execution**: Claude AI interprets steps and controls the browser.
- 🎭 **Playwright Integration**: Uses Playwright MCP for reliable browser automation.
- ✅ **Smart Verification**: AI validates expected results against actual page state.
- 📊 **Test History**: Results saved to `.e2e-results/` for tracking.

## 🛠️ Technologies Used

- **TypeScript**: Type-safe codebase.
- **Anthropic Claude API**: LLM for test interpretation and execution.
- **Playwright MCP**: Browser automation via Model Context Protocol.
- **Commander**: CLI interface.

## 📂 Project Structure

```
📦 e2e-ai-tests
├── 📁 src/
│   ├── 📜 cli.ts           # CLI entry point
│   ├── 📜 runner.ts        # Test orchestration
│   ├── 📜 llm-adapter.ts   # Claude API communication
│   ├── 📜 mcp-client.ts    # Playwright browser control
│   ├── 📜 parser.ts        # JSON test file loader
│   └── 📜 reporter.ts      # Console output and history
├── 📁 tests/
│   └── 📜 *.json           # Test files
└── 📜 e2e.config.json      # Configuration (optional)
```

## 🚀 Getting Started

Follow these steps to get a copy of the project up and running on your local machine.

### 📥 Installation

1. Clone the repository:
    ```bash
    git clone git@github.com:good-gis/e2e-ai-tests.git
    ```
2. Navigate to the project directory:
    ```bash
    cd e2e-ai-tests
    ```
3. Install dependencies:
    ```bash
    npm install
    ```
4. Set your Anthropic API key:
    ```bash
    export ANTHROPIC_API_KEY=your_api_key_here
    ```
5. Build the project:
    ```bash
    npm run build
    ```

### ▶️ Usage

Run all tests:
```bash
npm run start run
```

Run a specific test:
```bash
npm run start run tests/todo-add.json
```

Run with visible browser:
```bash
npm run start run --headed
```

### 📝 Test File Format

```json
{
  "name": "Add todo item",
  "url": "https://example.com/todo",
  "steps": [
    "Find the input field for new task",
    "Type 'Buy milk'",
    "Press Enter"
  ],
  "expectedResults": [
    "Task 'Buy milk' appears in the list",
    "Input field is cleared"
  ]
}
```

---

✨ Made with ❤️ by [good-gis](https://github.com/good-gis/) ✨
