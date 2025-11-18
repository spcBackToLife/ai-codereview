# Code Review Tool

基于 DeepSeek AI 的代码审查工具，可以自动对比 Git 分支差异并进行代码审查。

## 功能特性

- 🔍 **自动分支对比**：支持对比当前分支与指定分支（默认 master）
- 🔎 **分支搜索**：交互式分支选择，支持搜索过滤
- 🤖 **AI 代码审查**：基于 DeepSeek 模型进行智能代码审查
- 📊 **可视化展示**：类似 GitHub 的代码审查界面，展示 Diff 和评论
- 🚀 **自动启动**：审查完成后自动启动本地服务器和浏览器

## 安装

### 1. 安装依赖

```bash
cd codereview/code-review-tool

# 安装主项目依赖
npm install

# 安装前端 UI 依赖
cd ui
npm install
cd ..
```

### 2. 构建项目

```bash
# 构建 TypeScript 代码
npm run build

# 构建前端（可选，开发模式下会自动启动）
npm run build:ui
```

### 3. 全局安装（可选）

```bash
# 在项目根目录执行
npm link

# 或者使用 npm install -g . 安装到全局
```

安装后，可以在任何目录使用 `code-review` 命令。

## 配置

在使用前，需要设置 DeepSeek API Key：

```bash
export DEEPSEEK_API_KEY=your_api_key_here
```

或者在项目根目录创建 `.env` 文件：

```
DEEPSEEK_API_KEY=your_api_key_here
```

## 使用方法

### 基本用法

```bash
# 对比当前分支与 master 分支
code-review master

# 对比当前分支与指定分支
code-review develop

# 不指定分支，会弹出交互式选择
code-review

# 使用额外的规则文件
code-review master --rules ./custom-rules.json ./another-rules.json
```

### 开发模式

```bash
# 使用 tsx 直接运行（无需编译）
npm run dev master

# 或者直接运行 TypeScript 文件
npx tsx src/cli.ts master
```

### 首次使用前

确保 UI 依赖已安装：

```bash
cd ui
npm install
cd ..
```

## 工作流程

1. **选择分支**：如果没有指定分支，工具会列出所有远程分支供选择
2. **获取 Diff**：对比当前分支与目标分支的代码差异
3. **AI 审查**：调用 DeepSeek API 对代码变更进行审查
4. **保存结果**：将审查结果保存到 `~/.code-review/` 目录
5. **启动服务**：自动启动本地服务器（API: 3001, UI: 3000）
6. **打开浏览器**：自动打开浏览器展示审查结果

## 项目结构

```
code-review-tool/
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── git/
│   │   ├── branchSelector.ts  # 分支选择逻辑
│   │   └── diff.ts            # Git diff 解析
│   ├── review/
│   │   └── agent.ts           # DeepSeek AI 审查 Agent
│   ├── server/
│   │   └── index.ts           # API 服务器
│   └── utils/
│       └── storage.ts         # 结果存储
├── ui/                        # React 前端应用
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── ReviewView.tsx
│   │       ├── FileDiffView.tsx
│   │       ├── CommentMarker.tsx
│   │       └── SummaryPanel.tsx
│   └── package.json
└── package.json
```

## 代码审查规范

工具会自动加载内置的规范文件（位于 `src/review/rules/`）：
- `typescript.json` - TypeScript 开发规范
- `react.json` - React 开发规范
- `codeDesign.json` - 代码设计规范

### 使用自定义规则文件

你可以通过 `--rules` 参数添加额外的规则文件：

```bash
code-review master --rules ./my-custom-rules.json ./team-rules.json
```

**规则文件格式**：

规则文件必须是 JSON 格式，结构如下：

```json
{
  "category": "custom",
  "name": "自定义规范",
  "rules": [
    {
      "id": "custom-001",
      "name": "规则名称",
      "description": "规则描述",
      "level": "强卡控|建议|优化",
      "goodExample": "正确示例代码",
      "badExample": "错误示例代码",
      "reason": "规则原因说明"
    }
  ]
}
```

**注意事项**：
- 只处理 `.json` 文件，其他格式会被忽略
- 规则文件路径可以是相对路径或绝对路径
- 多个规则文件会被合并使用

## 审查结果格式

审查结果包含以下信息：

- **文件变更列表**：显示所有变更的文件及其状态（新增/修改/删除）
- **代码 Diff**：类似 GitHub 的代码对比视图
- **审查评论**：每条评论包含：
  - 文件路径和行号
  - 严重程度（error/warning/info）
  - 评论内容
  - 建议（如果有）
  - 规则 ID（如果匹配到规范）
  - 标签（tags）：标识问题属于哪个规范类别（typescript/react/code-design）

## 注意事项

1. 确保已安装 Node.js 18+ 和 npm
2. 需要有效的 DeepSeek API Key
3. 需要在 Git 仓库中运行
4. 确保有网络连接以调用 DeepSeek API

## 故障排除

### API Key 未设置
```
Error: DEEPSEEK_API_KEY environment variable is not set
```
解决：设置环境变量 `DEEPSEEK_API_KEY`

### 无法获取分支列表
确保当前目录是 Git 仓库，并且有远程分支。

### UI 服务器启动失败
检查端口 3000 和 3001 是否被占用，或者手动启动 UI：
```bash
cd ui && npm install && npm run dev
```

## License

MIT

