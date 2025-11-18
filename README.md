# @acr/ai-code-review

[![npm version](https://img.shields.io/npm/v/@acr/ai-code-review.svg)](https://www.npmjs.com/package/@acr/ai-code-review)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An AI-powered code review tool that automatically reviews code changes using Large Language Models (LLMs). Supports multiple LLM providers including OpenAI, Anthropic, Moonshot, and custom providers.

## 🌟 Features

### Core Capabilities

- 🤖 **AI-Powered Code Review**: Automatically reviews code changes using advanced LLM models
- 🔍 **Git Integration**: Seamlessly compares branches and analyzes diffs
- 📊 **Interactive Web UI**: Beautiful, GitHub-like interface for reviewing results
- 🎯 **Rule-Based Review**: Built-in rules for TypeScript, React, and code design best practices
- 🔄 **Batch Processing**: Intelligently splits large changesets into manageable batches
- 📝 **Detailed Comments**: Provides line-by-line comments with severity levels and suggestions
- ⚡ **Fast & Efficient**: Optimized token estimation and context management

### LLM Provider Support

- **OpenAI**: GPT-3.5, GPT-4, and other OpenAI models
- **Anthropic**: Claude models via Anthropic API
- **Moonshot**: Moonshot AI models
- **Custom**: Support for any OpenAI-compatible API endpoint (e.g., DeepSeek)

### Advanced Features

- 🌐 **Internationalization**: Supports English and Chinese (Simplified)
- 🔁 **Retry Mechanism**: Automatic retry for incomplete JSON responses
- 📈 **Statistics Dashboard**: Comprehensive statistics and problem analysis
- 🔗 **GitHub Integration**: Automatically post reviews as PR comments
- 💾 **Export Results**: Save review results as JSON files
- 🎨 **Theme Support**: Light and dark themes in the web UI

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g @acr/ai-code-review
```

### Local Installation

```bash
npm install --save-dev @acr/ai-code-review
```

### From Source

```bash
git clone <repository-url>
cd code-review-tool
npm install
npm run build
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in your project root or set environment variables:

```bash
# Required
LLM_API_KEY=your_api_key_here

# Optional - LLM Provider Configuration
LLM_PROVIDER=openai          # Options: openai, anthropic, moonshot, custom
LLM_MODEL_NAME=gpt-3.5-turbo # Model name (varies by provider)
LLM_BASE_URL=                # Required for custom provider
LLM_MAX_TOKENS=8192          # Maximum output tokens

# Optional - Language
LANG=en                      # Options: en, zh-CN (default: en)
```

### Example `.env` Files

**OpenAI:**
```bash
LLM_PROVIDER=openai
LLM_MODEL_NAME=gpt-4
LLM_API_KEY=sk-...
```

**Anthropic:**
```bash
LLM_PROVIDER=anthropic
LLM_MODEL_NAME=claude-3-opus-20240229
LLM_API_KEY=sk-ant-...
```

**Custom (DeepSeek):**
```bash
LLM_PROVIDER=custom
LLM_MODEL_NAME=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=sk-...
```

## 🚀 Quick Start

### Basic Usage

```bash
# Review changes against master branch
code-review master

# Review against a specific branch
code-review develop

# Interactive branch selection
code-review

# Use custom rules
code-review master --rules ./custom-rules.json

# Save results without starting server
code-review master --no-server --output ./review-results

# Use Chinese language
code-review master --lang zh-CN
```

### GitHub PR Integration

```bash
# Review and post to GitHub PR
code-review-github \
  --github-token $GITHUB_TOKEN \
  --github-owner owner \
  --github-repo repo \
  --github-pr 123 \
  --pwd /path/to/repo
```

## 📖 Usage Guide

### Command Line Options

#### `code-review` Command

```bash
code-review [baseBranch] [options]

Options:
  -r, --rules <files...>     Additional rule JSON files to load
  -p, --pwd <directory>      Working directory (default: current directory)
  --env <file>               Path to .env file (default: .env)
  --no-server                Do not start review report server
  -o, --output <directory>   Output directory for JSON files
  --max-retries <number>     Maximum continuation attempts for incomplete JSON (default: 10)
  --lang <language>          Language: en or zh-CN (default: en)
  -h, --help                 Display help
  -V, --version              Display version
```

#### `code-review-github` Command

```bash
code-review-github [options]

Options:
  -r, --rules <files...>           Additional rule JSON files to load
  -p, --pwd <directory>            Working directory (default: current directory)
  --env <file>                     Path to .env file (default: .env)
  --max-retries <number>           Maximum continuation attempts (default: 10)
  --github-token <token>           GitHub token (or set GITHUB_TOKEN env var)
  --github-owner <owner>           Repository owner (or set GITHUB_REPOSITORY_OWNER)
  --github-repo <repo>             Repository name (or set GITHUB_REPOSITORY_NAME)
  --github-pr <number>             PR number (or set GITHUB_PR_NUMBER)
  --review-event <event>           Review event: COMMENT, APPROVE, or REQUEST_CHANGES
  -o, --output <directory>         Output directory for JSON files
  --lang <language>                Language: en or zh-CN (default: en)
  -h, --help                       Display help
  -V, --version                    Display version
```

### Workflow

1. **Branch Selection**: If no branch is specified, the tool lists all remote branches for selection
2. **Diff Analysis**: Compares current branch with target branch and extracts code changes
3. **File Filtering**: Automatically filters to review only `.ts` and `.tsx` files
4. **Batch Processing**: Splits files into batches based on context window limits
5. **AI Review**: Calls LLM API to review each batch of changes
6. **Result Processing**: Parses and normalizes review comments
7. **Output**: Saves results and optionally starts web server

### Review Rules

The tool includes built-in rules for:

- **TypeScript** (15 rules): Type safety, interface definitions, generics, etc.
- **React** (20 rules): Component design, hooks usage, performance optimization, etc.
- **Code Design** (21 rules): Function design, code organization, error handling, etc.

#### Custom Rules

Create custom rule files in JSON format:

```json
{
  "category": "custom",
  "name": "Custom Rules",
  "rules": [
    {
      "id": "custom-001",
      "name": "Rule Name",
      "description": "Rule description",
      "level": "strict|suggestion|optimization",
      "goodExample": "Correct example code",
      "badExample": "Incorrect example code",
      "reason": "Why this rule exists"
    }
  ]
}
```

Load custom rules:

```bash
code-review master --rules ./my-rules.json ./team-rules.json
```

## 🎨 Web UI Features

The web interface provides:

- **File Tree**: Navigate through changed files
- **Diff View**: Side-by-side code comparison
- **Comment Markers**: Inline comments with severity indicators
- **Statistics Dashboard**: 
  - Problem type distribution (pie chart)
  - Rule statistics
  - File-level statistics
- **Filtering**: Filter comments by severity, file, or rule
- **Theme Toggle**: Switch between light and dark themes

## 🔗 GitHub Actions Integration

See [README-GITHUB.md](./README-GITHUB.md) for detailed GitHub Actions setup instructions.

Quick setup:

1. Copy `examples/github-workflow/code-review.yml` to `.github/workflows/`
2. Configure GitHub Secrets (LLM_API_KEY, etc.)
3. Push to trigger automatic code reviews on PRs

## 📊 Review Result Format

### Comment Structure

```typescript
{
  filePath: string;        // File path
  line: number;            // Start line number
  endLine: number;         // End line number
  severity: 'error' | 'warning' | 'info';
  message: string;         // Comment message
  ruleId: string;          // Rule ID
  ruleName: string;        // Rule name
  ruleLevel: string;       // Rule level (strict/suggestion/optimization)
  ruleDesc: string;        // Rule description
  suggestion?: string;     // Optional suggestion
  tags?: string[];         // Optional tags
}
```

### Review Result

```typescript
{
  comments: ReviewComment[];
  summary: string;
  startTime?: string;      // ISO 8601 format
  endTime?: string;        // ISO 8601 format
  duration?: number;       // Duration in milliseconds
}
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Install UI dependencies
cd ui && npm install && cd ..

# Build
npm run build

# Development mode
npm run dev master
```

### Project Structure

```
code-review-tool/
├── src/
│   ├── cli.ts              # Main CLI entry
│   ├── cli-github.ts       # GitHub CLI entry
│   ├── git/                # Git operations
│   ├── review/             # Review logic
│   │   ├── adapters/       # LLM provider adapters
│   │   ├── agent.ts        # Review agent
│   │   └── rules/          # Built-in rules
│   ├── server/             # Web server
│   └── utils/              # Utilities
│       ├── i18n.ts         # Internationalization
│       ├── github.ts       # GitHub API
│       └── storage.ts      # File storage
├── ui/                     # React web UI
└── examples/               # Example files
```

## 🌍 Internationalization

The tool supports multiple languages:

- **English (en)**: Default language
- **Chinese Simplified (zh-CN)**: Full Chinese support

Set language via CLI:

```bash
code-review master --lang zh-CN
```

Or via environment variable:

```bash
export LANG=zh-CN
code-review master
```

## 📝 Examples

### Example 1: Basic Review

```bash
code-review master
```

### Example 2: Review with Custom Rules

```bash
code-review develop --rules ./team-rules.json
```

### Example 3: Save Results Only

```bash
code-review master --no-server --output ./reviews
```

### Example 4: GitHub PR Review

```bash
code-review-github \
  --github-token $GITHUB_TOKEN \
  --github-owner myorg \
  --github-repo myrepo \
  --github-pr 42
```

### Example 5: Custom LLM Provider

```bash
# .env
LLM_PROVIDER=custom
LLM_MODEL_NAME=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=sk-...

code-review master
```

## 🐛 Troubleshooting

### Common Issues

**Issue**: `LLM_API_KEY environment variable is not set`

**Solution**: Set the `LLM_API_KEY` environment variable or create a `.env` file.

**Issue**: `Context length exceeded`

**Solution**: The changeset is too large. The tool automatically batches files, but if a single file exceeds the limit, consider:
- Using a model with a larger context window
- Reducing the `LLM_MAX_TOKENS` value
- Reviewing smaller changesets

**Issue**: `Failed to parse JSON response`

**Solution**: The tool automatically retries incomplete JSON responses. If it still fails:
- Increase `--max-retries` value
- Check your API key and network connection
- Try a different model

**Issue**: Server port already in use

**Solution**: The tool automatically finds an available port. If issues persist, check for other processes using ports 3000-3010.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📚 Related Documentation

- [GitHub Actions Integration Guide](./README-GITHUB.md)
- [Chinese Documentation](./README.zh-CN.md)

## 🙏 Acknowledgments

Built with:
- [OpenAI SDK](https://github.com/openai/openai-node)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)

---

Made with ❤️ for better code quality
