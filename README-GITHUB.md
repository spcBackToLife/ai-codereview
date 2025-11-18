# GitHub Actions 集成指南

本工具支持在 GitHub Actions 中自动运行代码审查，并将结果作为 PR 评论提交。

## 快速开始

### 1. 安装 CLI 工具

`code-review-tool` 已发布为 npm 包，可以通过以下方式安装：

#### 全局安装（推荐用于 CI/CD）

```bash
npm install -g @acr/ai-code-review
```

#### 本地安装（用于项目依赖）

```bash
npm install --save-dev @acr/ai-code-review
```

安装后可以使用 `code-review-github` 命令。

### 2. 添加 GitHub Actions Workflow

将 `examples/github-workflow/code-review.yml` 文件复制到你的仓库的 `.github/workflows/` 目录下。

**重要**: 
- 如果使用全局安装（推荐），workflow 中会使用 `npm install -g @acr/ai-code-review`
- 如果使用 npx（无需安装），可以取消注释 workflow 中的 npx 方式

### 3. 配置 GitHub Secrets

在你的 GitHub 仓库设置中添加以下 Secrets：

**必需:**
- `LLM_API_KEY`: LLM API 密钥

**可选:**
- `LLM_PROVIDER`: LLM 提供商（默认: `openai`）
  - 可选值: `openai`, `anthropic`, `moonshot`, `custom`
- `LLM_MODEL_NAME`: 模型名称（默认: `gpt-3.5-turbo`）
- `LLM_BASE_URL`: 自定义 API 地址（仅 `custom` 模式需要）
- `LLM_MAX_TOKENS`: 最大输出 tokens（默认: `8192`）
- `MAX_RETRIES`: 最大续写次数（默认: `10`）

### 4. 配置工作流

根据需要修改 `.github/workflows/code-review.yml`：

- **触发条件**: 默认在 PR 打开、更新、重新打开时触发
- **对比分支**: 自动从 PR 的 base 分支获取
- **Review 事件**: 默认使用 `COMMENT`，可以根据错误数量自动切换为 `REQUEST_CHANGES`

## Workflow 配置说明

### 基本配置

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
```

### 权限配置

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

### 环境变量

Workflow 会自动设置以下环境变量：

- `GITHUB_TOKEN`: GitHub Actions 自动提供的 token（无需手动配置）
- `GITHUB_REPOSITORY_OWNER`: 仓库所有者（自动获取）
- `GITHUB_REPOSITORY_NAME`: 仓库名称（自动获取）
- `GITHUB_PR_NUMBER`: PR 编号（自动获取）
- `GITHUB_BASE_REF`: PR 的 base 分支（自动获取）

## 手动运行

你也可以在本地或 CI 环境中手动运行：

### 使用全局安装的命令

```bash
# 使用环境变量
export GITHUB_TOKEN=your_github_token
export GITHUB_REPOSITORY_OWNER=owner
export GITHUB_REPOSITORY_NAME=repo
export GITHUB_PR_NUMBER=123

# 运行审查并提交到 GitHub
code-review-github \
  --pwd /path/to/repo \
  --max-retries 10 \
  --review-event COMMENT
```

### 使用 npx（需要先安装包）

```bash
# 先安装包（本地或全局）
npm install @acr/ai-code-review

# 然后使用 npx 执行命令
npx code-review-github \
  --github-token your_token \
  --github-owner owner \
  --github-repo repo \
  --github-pr 123 \
  --pwd /path/to/repo \
  --max-retries 10 \
  --review-event COMMENT
```

**注意**: 使用 npx 时，需要先安装包（本地或全局），然后直接使用 `npx code-review-github` 命令。

### 使用命令行参数

```bash
code-review-github \
  --github-token your_token \
  --github-owner owner \
  --github-repo repo \
  --github-pr 123 \
  --pwd /path/to/repo \
  --max-retries 10 \
  --review-event COMMENT
```

## Review 事件类型

- `COMMENT`: 仅添加评论，不阻止合并（默认）
- `APPROVE`: 批准 PR
- `REQUEST_CHANGES`: 请求修改，会阻止合并

**注意**: 如果使用 `COMMENT` 事件但发现错误，工具会自动切换为 `REQUEST_CHANGES`。

## 输出格式

GitHub PR Review 会包含：

1. **统计信息**: 错误、警告、信息数量
2. **总结**: AI 生成的审查总结
3. **行内评论**: 每个问题会在对应代码行添加评论，包含：
   - 严重程度（错误/警告/信息）
   - 规则级别（强卡控/建议/优化）
   - 规则名称和描述
   - 问题描述
   - 修复建议（如果有）

## 故障排除

### 权限问题

如果遇到权限错误，检查：
1. Workflow 的 `permissions` 配置是否正确
2. GitHub token 是否有足够的权限（`GITHUB_TOKEN` 由 GitHub Actions 自动提供，通常无需额外配置）

### API 调用失败

检查：
1. `LLM_API_KEY` 是否正确设置
2. API 端点是否可访问
3. 网络连接是否正常

### 评论未显示

检查：
1. PR 是否已创建
2. GitHub token 是否有 `pull-requests: write` 权限
3. 查看 Actions 日志中的错误信息

### CLI 命令未找到

如果 `code-review-github` 命令未找到：
1. 确保已正确安装 npm 包：`npm install -g @acr/ai-code-review`
2. 检查 `PATH` 环境变量是否包含 npm 全局 bin 目录
3. 或者使用 `npx @acr/ai-code-review github` 命令（无需安装）
