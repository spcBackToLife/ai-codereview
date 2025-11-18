# 告别低效代码审查！我用 AI 打造了一个智能代码审查工具，CLI 轻量化 + 美观界面 + 智能边界处理

> 💡 **前言**：还在为代码审查效率低、规则不统一而烦恼？我开发了一个基于大语言模型的 AI 代码审查工具 `@aicodereview/ai-code-review`。**最大的亮点是**：CLI 轻量化本地执行、美观的 Web 审查界面、智能的边界处理（批量处理 + 自动续写）。支持 OpenAI、Anthropic、Moonshot、DeepSeek 等多种模型，还能自动集成到 GitHub PR 流程中。今天来分享一下这个工具的设计思路和使用体验。

## 📌 文章目录

*   [为什么需要 AI 代码审查？](#为什么需要-ai-代码审查)
*   [工具核心特点](#工具核心特点)
*   [三大核心亮点](#三大核心亮点)
*   [快速开始](#快速开始)
*   [实际效果展示](#实际效果展示)
*   [技术实现亮点](#技术实现亮点)
*   [使用体验](#使用体验)
*   [未来规划](#未来规划)
*   [总结](#总结)

## 🤔 为什么需要 AI 代码审查？

作为一名前端开发工程师，我经常遇到这样的问题：

1.  **代码审查效率低**：人工审查代码耗时耗力，特别是面对大型 PR 时，审查者需要逐行阅读代码，容易遗漏问题
2.  **规则不统一**：团队内部代码规范难以统一执行，每个人对最佳实践的理解不同
3.  **审查质量不稳定**：依赖审查者的经验和状态，容易出现遗漏或过度审查
4.  **重复性工作**：很多代码问题（如魔法数字、函数过长、类型安全等）是重复的，完全可以自动化

于是，我决定开发一个基于 AI 的代码审查工具，让 AI 帮助开发者进行更高效、更一致的代码审查。

## 🚀 工具介绍：@aicodereview/ai-code-review

`@aicodereview/ai-code-review` 是一个基于大语言模型的智能代码审查工具，它能够：

*   🤖 **自动审查代码变更**：基于 Git diff 自动分析代码变更，无需手动操作
*   📊 **可视化审查结果**：提供类似 GitHub 的 Web 界面，直观展示审查结果
*   🎯 **基于规则的审查**：内置 TypeScript、React、代码设计等 56+ 条最佳实践规则
*   🔄 **智能批量处理**：自动将大型变更集拆分为批次，优化 token 使用
*   🌐 **多模型支持**：支持 OpenAI、Anthropic、Moonshot 以及自定义 API（如 DeepSeek）
*   🔗 **GitHub 集成**：可自动将审查结果发布为 PR 评论

## ✨ 三大核心亮点

### 1. 🚀 CLI 轻量化，本地可执行，即时查看结果

**核心优势**：

*   ✅ **零配置启动**：一条命令即可开始审查，无需复杂配置
*   ✅ **本地执行**：所有数据在本地处理，保护代码隐私
*   ✅ **即时反馈**：审查完成后立即启动 Web 服务器，查看结果
*   ✅ **轻量级**：不依赖外部服务，完全本地化运行

```bash
# 一条命令，完成所有操作
code-review master

# 审查完成后自动启动服务器，浏览器自动打开
# http://localhost:3000
```

**使用场景**：

*   本地开发时快速审查代码变更
*   提交 PR 前自我审查
*   团队内部代码质量检查

### 2. 🎨 美观的 CodeReview 页面，数据统计 + 主题切换

工具提供了类似 GitHub 的专业审查界面，包含：

#### 🔍 CLI 执行

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/25e8564ce8094e029850bb32c4e666d1~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgc3BjQmFja1RvTGlmZQ==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjI0MjY1OTQ1MjcxODc3NSJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1763566121&x-orig-sign=f7ZLkn6CNlioRHQZxm5N%2F3j%2B6Cg%3D)


#### 💬 代码审查界面

![代码审查界面转存失败，建议直接上传图片文件](./iShot_2025-11-18_20.56.05.png)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/ea000637594b43e6b925d7e361e8f9da~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgc3BjQmFja1RvTGlmZQ==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjI0MjY1OTQ1MjcxODc3NSJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1763566043&x-orig-sign=tpGbWFfET4k%2F6yNRb4nrGtVR6ek%3D)
*   **详细评论展示**：每条评论包含规则信息、改进建议
*   **代码定位**：点击评论自动跳转到对应代码行
*   **规则详情**：查看规则描述、正确/错误示例

#### 📈 统计面板

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/ed417f314d464b9a9508a057b60419e2~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgc3BjQmFja1RvTGlmZQ==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjI0MjY1OTQ1MjcxODc3NSJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1763566055&x-orig-sign=0FpU6PLyz4MzAuRasoVc5%2FvqRD0%3D)
*   **问题类型分布**：饼图展示 error/warning/info 占比
*   **规则统计**：展示违反最多的规则
*   **文件统计**：各文件的问题数量
*   **交互式过滤**：点击统计项可快速过滤评论




#### 🎨 主题切换

*   **一键切换**：右上角主题切换按钮

### 3. 🛡️ 智能边界处理，应对大规模审查

这是工具的核心技术亮点，解决了 AI 代码审查中的关键问题：

#### 🔄 智能批量处理

**问题**：大型 PR 可能包含数百个文件，远超模型上下文限制

**解决方案**：

*   ✅ **自动 token 估算**：精确估算中英文混合代码的 token 数量
*   ✅ **智能分批**：根据模型上下文窗口自动拆分文件批次
*   ✅ **单文件处理**：超大文件单独处理，避免超出限制
*   ✅ **失败重试**：自动重试失败的批次，确保完整性

```typescript
// 自动分批逻辑
- 估算每个文件的 token 数
- 根据模型上下文限制（如 131072 tokens）
- 智能组合文件，最大化批次利用率
- 预留响应 token 空间
```

#### 🔁 自动续写机制

**问题**：AI 返回的 JSON 可能被截断，导致解析失败

**解决方案**：

*   ✅ **JSON 完整性检测**：自动检测 JSON 是否完整
*   ✅ **智能续写**：检测到截断后自动请求 AI 继续完成
*   ✅ **增量解析**：已解析的部分不会丢失
*   ✅ **可配置重试**：最多支持 10 次续写（可通过 `--max-retries` 配置）


#### 📊 实际效果

**测试场景**：审查包含 80+ 文件的 PR

*   **传统方式**：需要手动分批，容易遗漏，耗时 2-3 小时
*   **使用本工具**：
    *   ⚡ 自动分批：5 个批次，每个批次 15-20 个文件
    *   ⚡ 自动续写：3 个批次触发了续写，全部成功完成
    *   ⚡ 总耗时：8 分钟
    *   ✅ 完整性：100% 覆盖所有文件

## 💡 其他核心特性

### 多 LLM 提供商支持

工具支持多种主流 LLM 提供商，你可以根据需求选择最适合的模型：

```bash
# OpenAI
LLM_PROVIDER=openai
LLM_MODEL_NAME=gpt-4

# Anthropic Claude
LLM_PROVIDER=anthropic
LLM_MODEL_NAME=claude-3-opus-20240229

# Moonshot
LLM_PROVIDER=moonshot
LLM_MODEL_NAME=moonshot-v1-8k

# 自定义（如 DeepSeek）
LLM_PROVIDER=custom
LLM_MODEL_NAME=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com
```

### 内置审查规则

工具内置了 56+ 条代码审查规则，涵盖：

*   **TypeScript 规则**（15 条）：类型安全、接口定义、泛型使用等
*   **React 规则**（20 条）：组件设计、Hooks 使用、性能优化等
*   **代码设计规则**（21 条）：函数设计、代码组织、错误处理等

每条规则都包含：

*   规则描述和原因
*   正确示例和错误示例
*   严重程度级别（强卡控/建议/优化）

### GitHub Actions 集成

可以轻松集成到 GitHub Actions 工作流中，自动审查 PR：

```yaml
- name: AI Code Review
  uses: actions/setup-node@v3
  with:
    node-version: '18'
    
- name: Run Code Review
  run: |
    npm install -g @aicodereview/ai-code-review
    code-review-github \
      --github-token ${{ secrets.GITHUB_TOKEN }} \
      --github-owner ${{ github.repository_owner }} \
      --github-repo ${{ github.event.repository.name }} \
      --github-pr ${{ github.event.pull_request.number }}
  env:
    LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
```

## 📖 快速开始

### 安装

```bash
npm install -g @aicodereview/ai-code-review
```

### 配置

创建 `.env` 文件：

```bash
LLM_API_KEY=your_api_key_here
LLM_PROVIDER=custom
LLM_MODEL_NAME=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com
LLM_MAX_TOKENS=8192
```

### 使用

```bash
# 审查当前分支与 master 的差异
code-review master

# 使用自定义规则
code-review master --rules ./team-rules.json

# 仅保存结果，不启动服务器
code-review master --no-server --output ./review-results

# 使用中文
code-review master --lang zh-CN
```

## 🎯 实际效果展示

### 审查结果示例

工具会生成详细的审查报告，包括：

*   **问题定位**：精确到文件、行号
*   **严重程度**：error（必须修复）、warning（建议修复）、info（优化建议）
*   **规则关联**：每个问题都关联到具体的审查规则
*   **改进建议**：提供具体的代码改进建议

### 统计信息

工具会自动生成统计信息：

*   问题类型分布（饼图）
*   规则违反统计
*   文件级别统计
*   审查耗时和 token 使用情况

### 边界处理效果

**场景 1：大型 PR（80+ 文件）**

    ✓ 自动拆分为 5 个批次
    ✓ 每个批次 15-20 个文件
    ✓ 总耗时：8 分钟
    ✓ 完整性：100%

**场景 2：JSON 截断处理**

    ✓ 检测到 JSON 不完整
    ✓ 自动请求续写（3 次）
    ✓ 成功合并所有评论
    ✓ 无数据丢失

**场景 3：超大文件处理**

    ✓ 检测到单个文件超过限制
    ✓ 自动单独处理
    ✓ 成功完成审查

## 🔧 技术实现亮点

### 1. 智能 Token 估算

针对中英文混合代码，实现了更准确的 token 估算：

```typescript
// 中文：约 1.5 个字符 = 1 token
// 英文/代码：约 4 个字符 = 1 token
// 混合内容：使用加权平均
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  // 加权平均计算
  return Math.ceil(chineseChars / 1.5 + otherChars / 4) + 10; // 预留格式开销
}
```

### 2. JSON 续写机制（核心亮点）

当 AI 返回的 JSON 不完整时，工具会自动请求续写：

```typescript
// 续写流程
async function callLLMAPIWithCompletion(messages, maxContinuations = 10) {
  let fullResponse = '';
  let continuationCount = 0;
  
  while (continuationCount <= maxContinuations) {
    const response = await callLLMAPI(messages);
    fullResponse += response;
    
    // 检测 JSON 完整性
    if (isJSONComplete(fullResponse)) {
      return parseJSON(fullResponse);
    }
    
    // 请求续写
    continuationCount++;
    messages.push({
      role: 'user',
      content: `请继续完成 JSON 输出...`
    });
  }
}
```

**关键特性**：

*   ✅ 检测 JSON 完整性（括号匹配、引号闭合）
*   ✅ 自动提取已解析的部分（避免重复）
*   ✅ 智能续写提示（包含上下文信息）
*   ✅ 可配置重试次数（默认 10 次）

### 3. 智能批量处理算法

```typescript
function splitIntoBatches(files, maxTokens) {
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;
  
  for (const file of files) {
    const fileTokens = estimateTokens(file.diff);
    
    // 单个文件超过限制，单独处理
    if (fileTokens > maxTokens * 0.8) {
      batches.push([file]);
      continue;
    }
    
    // 添加到当前批次
    if (currentTokens + fileTokens < maxTokens) {
      currentBatch.push(file);
      currentTokens += fileTokens;
    } else {
      // 开始新批次
      batches.push(currentBatch);
      currentBatch = [file];
      currentTokens = fileTokens;
    }
  }
  
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  return batches;
}
```

### 4. 规则映射和验证

确保每个评论都包含完整的规则信息：

*   自动从规则文件中加载规则
*   验证评论中的规则 ID
*   自动补充缺失的规则信息
*   支持自定义规则文件

### 5. 国际化支持

完整支持中英文：

*   CLI 输出国际化
*   Web UI 界面国际化
*   错误消息国际化
*   默认使用英文，可通过 `--lang` 切换

## 📊 使用体验

### 优点

1.  **效率提升**：原本需要 1-2 小时的代码审查，现在几分钟就能完成
2.  **一致性**：所有代码都按照统一的规则进行审查，不会遗漏
3.  **学习价值**：每次审查都是一次学习，可以看到 AI 给出的改进建议
4.  **可定制**：支持自定义规则，可以根据团队需求调整
5.  **边界处理完善**：自动处理大规模审查和 JSON 截断问题，无需人工干预
6.  **界面美观**：专业的审查界面，数据统计一目了然

### 注意事项

1.  **API 成本**：使用 LLM API 会产生费用，建议合理控制审查频率
2.  **模型选择**：不同模型的审查质量有差异，建议根据项目需求选择
3.  **规则调整**：内置规则可能需要根据项目实际情况调整
4.  **网络要求**：需要能够访问 LLM API（OpenAI、DeepSeek 等）

## 🚀 未来规划

*   [ ] 支持更多编程语言（Java、Python、Go 等）
*   [ ] 支持更多 LLM 提供商（通义千问、文心一言等）
*   [ ] 提供 VS Code 插件
*   [ ] 支持增量审查（只审查新增代码）
*   [ ] 提供审查报告导出功能
*   [ ] 支持团队规则共享和版本管理

## 📦 项目地址

*   **GitHub**：[欢迎 Star ⭐ 和 Fork 🍴](https://github.com/spcBackToLife/ai-codereview/tree/main)

## 💬 使用案例

### 案例 1：大型 PR 审查

之前审查一个包含 50+ 文件变更的 PR，需要：

*   ⏱️ 人工审查：2-3 小时
*   ❌ 容易遗漏问题
*   😫 审查者疲劳

使用 AI 工具后：

*   ⚡ 自动审查：5-10 分钟
*   ✅ 全面覆盖所有规则
*   📊 生成详细统计报告

### 案例 2：团队规范统一

团队内部代码规范执行不一致：

*   不同成员对规范理解不同
*   审查标准不统一
*   新人上手困难

使用 AI 工具后：

*   📋 统一的审查标准
*   🎓 新人可以通过审查结果学习规范
*   📈 团队代码质量稳步提升

## 🙏 总结

AI 代码审查工具不是要替代人工审查，而是要帮助开发者更高效地进行代码审查。

### 核心价值

1.  **🚀 CLI 轻量化**：一条命令完成所有操作，本地执行，保护隐私
2.  **🎨 美观界面**：专业的审查界面，数据统计清晰，支持主题切换
3.  **🛡️ 智能边界处理**：自动批量处理 + JSON 续写，应对大规模审查

### 主要能力

*   ✅ **快速发现常见问题**：自动检测魔法数字、函数过长、类型安全等问题
*   ✅ **统一代码规范执行**：确保所有代码都按照统一标准审查
*   ✅ **提供学习参考**：每次审查都是一次学习机会
*   ✅ **节省审查时间**：将审查时间从小时级降低到分钟级
*   ✅ **处理大规模变更**：智能分批处理，自动续写，确保完整性

### 适用场景

*   🏢 **团队开发**：统一代码规范，提升代码质量
*   🎓 **学习提升**：通过 AI 审查学习最佳实践
*   🚀 **快速迭代**：在快速开发中保持代码质量
*   🔍 **代码审计**：定期审查代码库，发现潜在问题
*   📦 **大型 PR 审查**：自动处理大规模代码变更，无需人工分批

如果你也在为代码审查效率而烦恼，不妨试试这个工具。特别是那些需要审查大型 PR 的团队，工具的智能边界处理能力会让你眼前一亮！欢迎提出建议和反馈！

***


## 🏷️ 标签

`#AI` `#代码审查` `#TypeScript` `#React` `#开发工具` `#LLM` `#GitHub` `#前端开发` `#代码质量` `#自动化`

***

**如果这篇文章对你有帮助，欢迎点赞 👍 和收藏 ⭐，也欢迎在评论区分享你的使用体验！**
