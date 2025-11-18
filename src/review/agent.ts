import { FileDiff } from '../git/diff.js';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import chalk from 'chalk';
import path from 'path';
// @ts-expect-error - cli-progress doesn't have type definitions
import cliProgress from 'cli-progress';
import { callLLMAPI, getLLMAdapter } from './adapters/index.js';
import type { LLMProvider } from './adapters/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Rule {
  id: string;
  name: string;
  description: string;
  level: string;
  goodExample?: string;
  badExample?: string;
  reason?: string;
}

export interface RuleSet {
  category: string;
  name: string;
  rules: Rule[];
}

export interface ReviewComment {
  filePath: string;
  line: number;
  endLine: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  ruleId: string;        // 规则ID（必需），对应审查规范中的规则ID
  ruleName: string;      // 规则名称（必需），对应审查规范中的规则名称
  ruleLevel: string;     // 规则级别（必需），对应审查规范中的规则级别（强卡控/建议/优化）
  ruleDesc: string;      // 规则描述（必需），对应审查规范中的规则描述
  suggestion?: string;
  tags?: string[];
}

export interface ReviewResult {
  comments: ReviewComment[];
  summary: string;
  startTime?: string;  // ISO 8601 格式的开始时间
  endTime?: string;    // ISO 8601 格式的结束时间
  duration?: number;   // 耗时（毫秒）
}

/**
 * 加载规则 JSON 文件
 */
async function loadRuleSet(filePath: string): Promise<RuleSet | null> {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    
    const content = await readFile(filePath, 'utf-8');
    const ruleSet = JSON.parse(content) as RuleSet;
    
    // 验证规则集格式
    if (!ruleSet.category || !ruleSet.name || !Array.isArray(ruleSet.rules)) {
      console.warn(`Invalid rule set format in ${filePath}`);
      return null;
    }
    
    return ruleSet;
  } catch (error) {
    console.warn(`Failed to load rule set from ${filePath}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 读取代码审查规范（返回规则对象数组和文本）
 */
async function loadReviewRules(additionalRuleFiles: string[] = []): Promise<{ rulesText: string; rulesMap: Map<string, Rule> }> {
  const rulesDir = join(__dirname, 'rules');
  const defaultRuleFiles = [
    join(rulesDir, 'typescript.json'),
    join(rulesDir, 'react.json'),
    join(rulesDir, 'codeDesign.json'),
  ];
  
  // 合并默认规则文件和额外规则文件
  const allRuleFiles = [...defaultRuleFiles, ...additionalRuleFiles];
  const ruleSets: RuleSet[] = [];
  
  // 加载所有规则文件
  for (const filePath of allRuleFiles) {
    // 只处理 JSON 文件
    if (!filePath.endsWith('.json')) {
      continue;
    }
    
    const ruleSet = await loadRuleSet(filePath);
    if (ruleSet) {
      ruleSets.push(ruleSet);
    }
  }
  
  // 构建规则映射表（用于后续验证和补充）
  const rulesMap = new Map<string, Rule>();
  
  // 将规则集转换为文本格式
  const rulesText: string[] = [];
  
  for (const ruleSet of ruleSets) {
    const categoryName = ruleSet.name || ruleSet.category;
    rulesText.push(`## ${categoryName}`);
    rulesText.push('');
    
    for (const rule of ruleSet.rules) {
      // 将规则添加到映射表
      rulesMap.set(rule.id, rule);
      
      // 将 level 映射到 severity
      let severity: 'error' | 'warning' | 'info' = 'warning';
      if (rule.level === '强卡控') {
        severity = 'error';
      } else if (rule.level === '建议') {
        severity = 'warning';
      } else if (rule.level === '优化') {
        severity = 'info';
      }
      
      rulesText.push(`### ${rule.id}: ${rule.name}`);
      rulesText.push(`**级别**: ${rule.level} → **必须使用 severity: "${severity}"** (这是强制要求，不允许自行判断)`);
      rulesText.push(`**描述**: ${rule.description}`);
      
      if (rule.reason) {
        rulesText.push(`**原因**: ${rule.reason}`);
      }
      
      if (rule.goodExample) {
        rulesText.push(`**正确示例**:\n\`\`\`typescript\n${rule.goodExample}\n\`\`\``);
      }
      
      if (rule.badExample) {
        rulesText.push(`**错误示例**:\n\`\`\`typescript\n${rule.badExample}\n\`\`\``);
      }
      
          rulesText.push('');
        }
      }

      const finalRulesText = rulesText.join('\n');
      
      // 将规则文本写入日志文件
      // try {
      //   const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      //   const filename = `review-rules-${timestamp}.txt`;
      //   const cwd = process.cwd();
      //   const filePath = path.join(cwd, filename);
      //   await writeFile(filePath, finalRulesText, 'utf-8');
      //   console.log(chalk.gray(`  ✓ 审查规范已保存到: ${filePath}`));
      //   console.log(chalk.gray(`    规则总数: ${rulesMap.size}`));
      // } catch (writeError) {
      //   console.warn(chalk.yellow(`  ⚠️  保存审查规范失败: ${writeError instanceof Error ? writeError.message : String(writeError)}`));
      // }

      return {
        rulesText: finalRulesText,
        rulesMap,
      };
    }

/**
 * 调用 LLM API（已废弃，使用 callLLMAPI 替代）
 * @deprecated 使用 callLLMAPI 替代
 */
async function callDeepSeekAPI(messages: Array<{ role: string; content: string }>): Promise<string> {
  return callLLMAPI(messages);
}

/**
 * 检查 JSON 是否完整
 */
function isJSONComplete(jsonStr: string): boolean {
  try {
    JSON.parse(jsonStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * 调用 LLM API 并确保返回完整的 JSON（最多续写 maxContinuations 次，默认 10 次）
 */
async function callLLMAPIWithCompletion(
  messages: Array<{ role: string; content: string }>,
  maxContinuations: number = 10,
  batchIndex?: number
): Promise<string> {
  let fullResponse = '';
  let continuationCount = 0;
  const batchInfo = batchIndex !== undefined ? `批次 ${batchIndex + 1}` : '';

  console.log(chalk.blue(`  🔄 ${batchInfo} 开始调用 AI API...`));

  while (continuationCount <= maxContinuations) {
    try {
      const callStartTime = Date.now();
      console.log(chalk.gray(`    ${batchInfo} API 调用 ${continuationCount === 0 ? '（初始）' : `（续写 ${continuationCount}/${maxContinuations}）`}...`));
      
      const response = await callLLMAPI(messages);
      const callDuration = Date.now() - callStartTime;
      
      fullResponse += response;
      console.log(chalk.gray(`    ${batchInfo} API 调用完成，耗时 ${callDuration}ms，当前响应长度: ${fullResponse.length} 字符`));

      // 检查是否是完整的 JSON
      if (isJSONComplete(fullResponse)) {
        console.log(chalk.green(`  ✓ ${batchInfo} JSON 输出完整（共 ${continuationCount + 1} 次调用）`));
        
        // 写入 fullResponse 到文件
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `ai-response-${batchIndex !== undefined ? `batch-${batchIndex + 1}-` : ''}${timestamp}.json`;
          const cwd = process.cwd();
          const filePath = path.join(cwd, filename);
          await writeFile(filePath, fullResponse, 'utf-8');
          console.log(chalk.gray(`    ${batchInfo} AI 响应已保存到: ${filePath}`));
        } catch (writeError) {
          console.warn(chalk.yellow(`    ⚠️  保存 AI 响应失败: ${writeError instanceof Error ? writeError.message : String(writeError)}`));
        }
        
        return fullResponse;
      }

      // 如果还没达到最大续写次数，继续请求
      if (continuationCount < maxContinuations) {
        console.log(chalk.yellow(`    ${batchInfo} JSON 不完整，准备续写（${continuationCount + 1}/${maxContinuations}）...`));
        // 发送续写请求，包含之前的响应作为上下文
        const last500Chars = fullResponse.slice(-500);
        messages.push({
          role: 'assistant',
          content: fullResponse,
        });
        messages.push({
          role: 'user',
          content: `请继续完成上面的 JSON 输出。之前的输出在 "${last500Chars}" 处被截断，请从那里继续输出完整的 JSON。`,
        });
        continuationCount++;
        
        // 续写时也需要等待一段时间，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // 达到最大续写次数，返回当前结果（可能不完整）
        console.warn(chalk.yellow(`  ⚠️  ${batchInfo} 达到最大续写次数 ${maxContinuations}，JSON 可能不完整`));
        
        // 即使不完整也写入文件
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `ai-response-${batchIndex !== undefined ? `batch-${batchIndex + 1}-` : ''}${timestamp}-incomplete.json`;
          const cwd = process.cwd();
          const filePath = path.join(cwd, filename);
          await writeFile(filePath, fullResponse, 'utf-8');
          console.log(chalk.gray(`    ${batchInfo} AI 响应（不完整）已保存到: ${filePath}`));
        } catch (writeError) {
          console.warn(chalk.yellow(`    ⚠️  保存 AI 响应失败: ${writeError instanceof Error ? writeError.message : String(writeError)}`));
        }
        
        return fullResponse;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`    ❌ ${batchInfo} API 调用失败: ${errorMessage}`));
      throw error;
    }
  }

  return fullResponse;
}

/**
 * 解析 AI 返回的 JSON 结果
 */
function parseReviewResult(aiResponse: string, fileDiffs: FileDiff[], rulesMap: Map<string, Rule>): ReviewResult {
  // 辅助函数：使用括号计数提取完整的 JSON 对象
  function extractJSONObject(text: string, startIndex: number = 0): string | null {
    let braceCount = 0;
    let startIdx = -1;
    let inString = false;
    let escapeNext = false;
    
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        if (startIdx === -1) startIdx = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          return text.substring(startIdx, i + 1);
        }
      }
    }
    
    return null;
  }

  // 首先检查是否有 markdown 代码块
  const codeBlockStart = aiResponse.indexOf('```');
  if (codeBlockStart !== -1) {
    const codeBlockEnd = aiResponse.indexOf('```', codeBlockStart + 3);
    if (codeBlockEnd !== -1) {
      const codeBlockContent = aiResponse.substring(codeBlockStart + 3, codeBlockEnd).trim();
      // 移除可能的 "json" 标记
      const jsonContent = codeBlockContent.replace(/^json\s*\n?/i, '').trim();
      
      // 使用括号计数提取完整的 JSON
      const jsonStr = extractJSONObject(jsonContent);
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.comments && Array.isArray(parsed.comments)) {
            console.warn('⚠️  Extracted JSON from markdown code block (AI should return pure JSON)');
            return {
              comments: parsed.comments,
              summary: parsed.summary || '代码审查完成',
            };
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON from code block:', parseError instanceof Error ? parseError.message : String(parseError));
        }
      }
    }
  }

  // 检查响应是否以 "{" 开头（符合要求）
  const trimmedResponse = aiResponse.trim();
  if (trimmedResponse.startsWith('{')) {
    // 使用括号计数提取完整的 JSON 对象（不依赖 endsWith，因为后面可能有其他内容）
    const jsonStr = extractJSONObject(trimmedResponse);
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.comments && Array.isArray(parsed.comments)) {
          // 检查是否完整（如果提取的 JSON 后面还有其他内容，给出提示）
          const jsonEndIndex = trimmedResponse.indexOf(jsonStr) + jsonStr.length;
          const remainingText = trimmedResponse.substring(jsonEndIndex).trim();
          if (remainingText.length > 0) {
            console.warn('⚠️  JSON extracted successfully, but there is additional content after JSON');
          }
          // 规范化评论数据：确保所有必需字段都存在
          const normalizedComments = parsed.comments.map((comment: any) => {
            const normalized: any = {
              ...comment,
              endLine: comment.endLine !== undefined ? comment.endLine : comment.line,
            };
            
            // 如果缺少规则信息，尝试从规则映射表中查找
            if (comment.ruleId && rulesMap.has(comment.ruleId)) {
              const rule = rulesMap.get(comment.ruleId)!;
              normalized.ruleId = comment.ruleId || rule.id;
              normalized.ruleName = comment.ruleName || rule.name;
              normalized.ruleLevel = comment.ruleLevel || rule.level;
              normalized.ruleDesc = comment.ruleDesc || rule.description;
            } else if (comment.ruleId) {
              // 如果 ruleId 存在但规则未找到，使用提供的值或设置默认值
              normalized.ruleId = comment.ruleId;
              normalized.ruleName = comment.ruleName || '未知规则';
              normalized.ruleLevel = comment.ruleLevel || '建议';
              normalized.ruleDesc = comment.ruleDesc || '规则信息缺失';
              console.warn(`⚠️  Rule not found for ruleId: ${comment.ruleId}`);
            } else {
              // 如果完全没有规则信息，设置默认值
              normalized.ruleId = 'unknown';
              normalized.ruleName = '未知规则';
              normalized.ruleLevel = '建议';
              normalized.ruleDesc = '规则信息缺失';
              console.warn('⚠️  Comment missing ruleId, using default values');
            }
            
            return normalized;
          });
          
          return {
            comments: normalizedComments,
            summary: parsed.summary || '代码审查完成',
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse extracted JSON:', parseError instanceof Error ? parseError.message : String(parseError));
      }
    } else {
      // 如果提取失败，尝试直接解析整个响应
      try {
        const parsed = JSON.parse(trimmedResponse);
        if (parsed.comments && Array.isArray(parsed.comments)) {
          // 规范化评论数据：确保所有必需字段都存在
          const normalizedComments = parsed.comments.map((comment: any) => {
            const normalized: any = {
              ...comment,
              endLine: comment.endLine !== undefined ? comment.endLine : comment.line,
            };
            
            // 如果缺少规则信息，尝试从规则映射表中查找
            if (comment.ruleId && rulesMap.has(comment.ruleId)) {
              const rule = rulesMap.get(comment.ruleId)!;
              normalized.ruleId = comment.ruleId || rule.id;
              normalized.ruleName = comment.ruleName || rule.name;
              normalized.ruleLevel = comment.ruleLevel || rule.level;
              normalized.ruleDesc = comment.ruleDesc || rule.description;
            } else if (comment.ruleId) {
              // 如果 ruleId 存在但规则未找到，使用提供的值或设置默认值
              normalized.ruleId = comment.ruleId;
              normalized.ruleName = comment.ruleName || '未知规则';
              normalized.ruleLevel = comment.ruleLevel || '建议';
              normalized.ruleDesc = comment.ruleDesc || '规则信息缺失';
              console.warn(`⚠️  Rule not found for ruleId: ${comment.ruleId}`);
            } else {
              // 如果完全没有规则信息，设置默认值
              normalized.ruleId = 'unknown';
              normalized.ruleName = '未知规则';
              normalized.ruleLevel = '建议';
              normalized.ruleDesc = '规则信息缺失';
              console.warn('⚠️  Comment missing ruleId, using default values');
            }
            
            return normalized;
          });
          
          return {
            comments: normalizedComments,
            summary: parsed.summary || '代码审查完成',
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse JSON directly:', parseError instanceof Error ? parseError.message : String(parseError));
      }
    }
  } else {
    // 如果不符合要求，给出警告并尝试提取
    console.warn('⚠️  AI response does not start with "{". Attempting to extract JSON...');
  }

  try {
    // 尝试从响应中提取 JSON（作为后备方案）
    const jsonStr = extractJSONObject(aiResponse);
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.comments && Array.isArray(parsed.comments)) {
          // 规范化评论数据：确保所有必需字段都存在
          const normalizedComments = parsed.comments.map((comment: any) => {
            const normalized: any = {
              ...comment,
              endLine: comment.endLine !== undefined ? comment.endLine : comment.line,
            };
            
            // 如果缺少规则信息，尝试从规则映射表中查找
            if (comment.ruleId && rulesMap.has(comment.ruleId)) {
              const rule = rulesMap.get(comment.ruleId)!;
              normalized.ruleId = comment.ruleId || rule.id;
              normalized.ruleName = comment.ruleName || rule.name;
              normalized.ruleLevel = comment.ruleLevel || rule.level;
              normalized.ruleDesc = comment.ruleDesc || rule.description;
            } else if (comment.ruleId) {
              // 如果 ruleId 存在但规则未找到，使用提供的值或设置默认值
              normalized.ruleId = comment.ruleId;
              normalized.ruleName = comment.ruleName || '未知规则';
              normalized.ruleLevel = comment.ruleLevel || '建议';
              normalized.ruleDesc = comment.ruleDesc || '规则信息缺失';
              console.warn(`⚠️  Rule not found for ruleId: ${comment.ruleId}`);
            } else {
              // 如果完全没有规则信息，设置默认值
              normalized.ruleId = 'unknown';
              normalized.ruleName = '未知规则';
              normalized.ruleLevel = '建议';
              normalized.ruleDesc = '规则信息缺失';
              console.warn('⚠️  Comment missing ruleId, using default values');
            }
            
            return normalized;
          });
          
          return {
            comments: normalizedComments,
            summary: parsed.summary || '代码审查完成',
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse extracted JSON:', parseError instanceof Error ? parseError.message : String(parseError));
      }
    }
    
    // 如果还是失败，尝试简单的正则匹配
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.comments && Array.isArray(parsed.comments)) {
          // 规范化评论数据：确保所有必需字段都存在
          const normalizedComments = parsed.comments.map((comment: any) => {
            const normalized: any = {
              ...comment,
              endLine: comment.endLine !== undefined ? comment.endLine : comment.line,
            };
            
            // 如果缺少规则信息，尝试从规则映射表中查找
            if (comment.ruleId && rulesMap.has(comment.ruleId)) {
              const rule = rulesMap.get(comment.ruleId)!;
              normalized.ruleId = comment.ruleId || rule.id;
              normalized.ruleName = comment.ruleName || rule.name;
              normalized.ruleLevel = comment.ruleLevel || rule.level;
              normalized.ruleDesc = comment.ruleDesc || rule.description;
            } else if (comment.ruleId) {
              // 如果 ruleId 存在但规则未找到，使用提供的值或设置默认值
              normalized.ruleId = comment.ruleId;
              normalized.ruleName = comment.ruleName || '未知规则';
              normalized.ruleLevel = comment.ruleLevel || '建议';
              normalized.ruleDesc = comment.ruleDesc || '规则信息缺失';
              console.warn(`⚠️  Rule not found for ruleId: ${comment.ruleId}`);
            } else {
              // 如果完全没有规则信息，设置默认值
              normalized.ruleId = 'unknown';
              normalized.ruleName = '未知规则';
              normalized.ruleLevel = '建议';
              normalized.ruleDesc = '规则信息缺失';
              console.warn('⚠️  Comment missing ruleId, using default values');
            }
            
            return normalized;
          });
          
          return {
            comments: normalizedComments,
            summary: parsed.summary || '代码审查完成',
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse JSON with regex:', parseError instanceof Error ? parseError.message : String(parseError));
      }
    }
  } catch (error) {
    console.warn('Failed to parse AI response as JSON:', error instanceof Error ? error.message : String(error));
    console.warn('AI Response preview:', aiResponse.substring(0, 500));
  }

  // 如果解析失败，尝试手动提取评论（作为最后的后备方案）
  const comments: ReviewComment[] = [];
  const lines = aiResponse.split('\n');
  
  for (const line of lines) {
    // 简单的启发式规则提取评论
    if (line.includes('错误') || line.includes('error') || line.includes('Error')) {
      // 尝试提取文件路径和行号
      const fileMatch = line.match(/([^\s]+\.(ts|tsx|js|jsx)):(\d+)/);
      if (fileMatch) {
        const lineNum = parseInt(fileMatch[3], 10);
        comments.push({
          filePath: fileMatch[1],
          line: lineNum,
          endLine: lineNum,
          severity: 'error',
          message: line,
          ruleId: 'unknown',
          ruleName: '未知规则',
          ruleLevel: '建议',
          ruleDesc: '规则信息缺失',
        });
      }
    }
  }

  // 如果所有解析尝试都失败，抛出异常
  if (comments.length === 0) {
    // 检查是否是 JSON 格式问题
    const hasJsonStart = aiResponse.trim().startsWith('{') || aiResponse.includes('```json') || aiResponse.includes('```');
    if (hasJsonStart) {
      throw new Error('无法解析 AI 返回的 JSON 响应。响应可能包含无效的 JSON 格式或控制字符。');
    } else {
      throw new Error('AI 返回的响应不是有效的 JSON 格式。响应应该以 "{" 开头。');
    }
  }

  return {
    comments,
    summary: aiResponse.substring(0, 200) + (aiResponse.length > 200 ? '...' : ''),
  };
}

/**
 * 改进的 token 估算
 * - 英文/代码：约 4 个字符 = 1 token
 * - 中文：约 1.5 个字符 = 1 token
 */
function estimateTokens(text: string): number {
  // 估算中文字符数（CJK 统一表意文字范围）
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  
  // 中文：1.5 字符/token，其他：4 字符/token
  const chineseTokens = Math.ceil(chineseChars / 1.5);
  const otherTokens = Math.ceil(otherChars / 4);
  
  return chineseTokens + otherTokens;
}

/**
 * 计算单个文件的 diff 文本大小（token 数）
 */
function estimateFileDiffTokens(fileDiff: FileDiff): number {
  const diffText = fileDiff.hunks.map(hunk => {
    const lines = hunk.lines.map(line => {
      const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';
      const lineNum = line.newLineNumber || line.oldLineNumber;
      const lineNumStr = lineNum ? `:${lineNum}` : '';
      return `${prefix}${lineNumStr} ${line.content}`;
    }).join('\n');
    return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${lines}`;
  }).join('\n\n');
  
  const fullText = `文件: ${fileDiff.filePath}\n状态: ${fileDiff.status}\n\n${diffText}`;
  return estimateTokens(fullText);
}

/**
 * 将文件列表拆分成多个批次，确保每个批次不超过上下文限制
 */
function splitFilesIntoBatches(
  fileDiffs: FileDiff[],
  rulesText: string,
  systemPrompt: string
): FileDiff[][] {
  // 获取模型配置
  const provider = (process.env.LLM_PROVIDER || 'openai') as LLMProvider;
  const modelName = process.env.LLM_MODEL_NAME || 'gpt-3.5-turbo';
  const maxTokens = parseInt(process.env.LLM_MAX_TOKENS || '8192', 10);
  
  const adapter = getLLMAdapter(provider);
  const maxContextLength = adapter.getMaxContextLength(modelName);
  
  // 预留空间：最大上下文 - 输出 tokens - 缓冲（1000 tokens）
  const reservedTokens = maxTokens + 1000;
  const maxContextTokens = maxContextLength - reservedTokens;
  
  console.log(chalk.gray(`  📊 模型上下文限制: ${maxContextLength} tokens, 预留: ${reservedTokens} tokens, 可用: ${maxContextTokens} tokens`));
  const batches: FileDiff[][] = [];
  let currentBatch: FileDiff[] = [];
  let currentBatchTokens = estimateTokens(systemPrompt) + estimateTokens(rulesText);
  
  // 添加基础提示词开销（约 500 tokens）
  currentBatchTokens += 500;
  
  for (const fileDiff of fileDiffs) {
    const fileTokens = estimateFileDiffTokens(fileDiff);
    
    // 如果单个文件就超过限制，单独成一批（虽然不太可能）
    if (fileTokens > maxContextTokens) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchTokens = estimateTokens(systemPrompt) + estimateTokens(rulesText) + 500;
      }
      console.warn(chalk.yellow(`  ⚠️  文件 ${fileDiff.filePath} 的 token 数 (${fileTokens}) 超过单批次限制 (${maxContextTokens})，将单独处理`));
      batches.push([fileDiff]);
      continue;
    }
    
    // 如果加上这个文件会超过限制，开始新批次
    if (currentBatchTokens + fileTokens > maxContextTokens && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [fileDiff];
      currentBatchTokens = estimateTokens(systemPrompt) + estimateTokens(rulesText) + 500 + fileTokens;
    } else {
      currentBatch.push(fileDiff);
      currentBatchTokens += fileTokens;
    }
  }
  
  // 添加最后一个批次
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  return batches;
}

/**
 * 构建审查提示词（单个文件或文件批次）
 */
function buildReviewPrompt(fileDiffs: FileDiff[], rules: string): string {
  const diffTexts = fileDiffs.map(file => {
    const hunksText = file.hunks.map(hunk => {
      const lines = hunk.lines.map(line => {
        const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';
        // 包含行号信息：优先使用 newLineNumber（对于新增和修改的行），否则使用 oldLineNumber（对于删除的行）
        const lineNum = line.newLineNumber || line.oldLineNumber;
        const lineNumStr = lineNum ? `:${lineNum}` : '';
        return `${prefix}${lineNumStr} ${line.content}`;
      }).join('\n');
      return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${lines}`;
    }).join('\n\n');
    
    return `文件: ${file.filePath}\n状态: ${file.status}\n\n${hunksText}`;
  }).join('\n\n---\n\n');

  return `请根据以下代码审查规范对以下代码变更进行审查：

${rules}

代码变更：
${diffTexts}

**重要：行号说明**
- diff 格式中，每行代码前面有行号标记，格式为 +行号 或 -行号 或  行号（空格表示上下文行）
- 例如：+37: import { ... } 表示这是新增的第 37 行
- 例如：-100: const value = ... 表示这是删除的第 100 行（旧文件中的行号）
- 例如： 50: // comment 表示这是第 50 行（上下文行，新旧文件都有）
- **line 和 endLine 必须使用 diff 中标记的行号**，优先使用 + 标记的行号（新文件行号），如果没有则使用 - 标记的行号（旧文件行号）

**请严格按照以下要求返回结果：**

1. 返回纯 JSON 格式，不要使用 markdown 代码块（不要用 \`\`\`json 包裹）
2. 返回的 JSON 必须以 "{" 开头，以 "}" 结尾
3. 返回的 JSON 必须符合以下结构：

{
  "comments": [
    {
      "filePath": "文件路径（字符串，必须与上面提供的文件路径完全一致）",
      "line": 开始行号（数字，必须是正整数）,
      "endLine": 结束行号（数字，必需，必须 >= line。单行评论时等于 line，多行评论时是结束行号）,
      "severity": "error" 或 "warning" 或 "info"（字符串，只能是这三个值之一）,
      "message": "评论内容（字符串，详细描述问题）",
      "ruleId": "规则ID（字符串，必需），对应上面代码审查规范中的规则ID（如 design-004）",
      "ruleName": "规则名称（字符串，必需），对应上面代码审查规范中的规则名称（如 '魔法数字和字符串'）",
      "ruleLevel": "规则级别（字符串，必需），对应上面代码审查规范中的规则级别（'强卡控'/'建议'/'优化'）",
      "ruleDesc": "规则描述（字符串，必需），对应上面代码审查规范中的规则描述",
      "suggestion": "改进建议（字符串，可选）",
      "tags": ["typescript", "react", "code-design"]（字符串数组，可选）
    }
  ],
  "summary": "审查总结（字符串，简要描述整体审查情况）"
}

**关键：severity 字段必须严格按照上面代码审查规范中每个规则的 level 字段映射（这是强制要求，不允许自行判断）：**
- 如果上面代码审查规范中某个规则的 level 是 "强卡控"，那么使用该规则时 severity **必须**是 "error"
- 如果上面代码审查规范中某个规则的 level 是 "建议"，那么使用该规则时 severity **必须**是 "warning"
- 如果上面代码审查规范中某个规则的 level 是 "优化"，那么使用该规则时 severity **必须**是 "info"
**绝对不允许根据问题严重程度自行判断，必须严格按照上面代码审查规范中对应规则的 level 来设置 severity！**

**重要提示：**
- 如果没有发现问题，返回空的 comments 数组：{"comments": [], "summary": "..."}
- 每个 comment 的 filePath 必须与上面代码变更中的文件路径完全匹配

**重要：每个问题必须单独一个评论，不要合并多个问题到一个评论中**
- 如果代码中有多个相同类型的问题（例如：多个魔法数字），每个问题都要单独创建一个评论
- 不要将多个问题合并成一个范围很大的评论（例如：不要将整个文件 121-1210 作为一个评论）

**重要：line 和 endLine 必须精确指向问题所在的具体位置（这是强制要求）**
- **必须使用 diff 中标记的行号**（每行代码前面的 +行号、-行号 或  行号），不能自己猜测或计算
- **必须仔细分析代码，找到问题出现的具体行号，不能使用文件最后一行或整个文件范围**
- 单行问题（如魔法数字、单个函数调用、接口定义等）：line 和 endLine 必须相同，指向问题所在的具体行号
  - 例如：如果看到 +37: interface IProps {，则 line: 37, endLine: 37
  - 例如：如果看到 +200: const value = 1722960000000;，则 line: 200, endLine: 200（注意：行号是200，不是1722960000000）
- 多行问题（如函数定义、代码块等）：line 是开始行号，endLine 是结束行号，必须精确到问题代码块的范围
  - 例如：函数定义从第 100 行开始到第 150 行结束，则 line: 100, endLine: 150
- **绝对禁止使用代码中的数字作为行号**（如魔法数字 1722960000000 不能作为行号）
- **绝对禁止使用文件最后一行作为 line 或 endLine**（除非问题确实在最后一行）
- **绝对禁止使用整个文件的范围**（如 line: 1, endLine: 1210），必须精确到具体问题所在的位置
- **对于组件长度、文件长度等整体性问题，应该指向组件定义开始的行号**（如 +50: const Component = () => { 中的 50），而不是文件最后一行

**每个 comment 的 ruleId、ruleName、ruleLevel、ruleDesc 必须填写**，对应上面代码审查规范中对应规则的完整信息：
- ruleId：规则ID（如 design-004）
- ruleName：规则名称（如 "魔法数字和字符串"）
- ruleLevel：规则级别（"强卡控"/"建议"/"优化"）
- ruleDesc：规则描述

- 直接返回 JSON，不要添加任何其他文字说明或 markdown 格式`;
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(): string {
  return `你是一个专业的代码审查助手。请根据提供的代码审查规范，对代码进行详细审查。

**重要：你必须返回纯 JSON 格式，不要使用 markdown 代码块（不要用 \`\`\`json 包裹）。**

**评论要求：**

**关键：severity 字段必须严格按照上面代码审查规范中每个规则的 level 字段映射（这是强制要求，不允许自行判断）：**
- 如果上面代码审查规范中某个规则的 level 是 "强卡控"，那么使用该规则时 severity **必须**是 "error"
- 如果上面代码审查规范中某个规则的 level 是 "建议"，那么使用该规则时 severity **必须**是 "warning"
- 如果上面代码审查规范中某个规则的 level 是 "优化"，那么使用该规则时 severity **必须**是 "info"
**绝对不允许根据问题严重程度自行判断，必须严格按照上面代码审查规范中对应规则的 level 来设置 severity！**

**重要：每个 comment 必须包含完整的规则信息字段（ruleId、ruleName、ruleLevel、ruleDesc）：**
- ruleId：必须填写，对应上面代码审查规范中的规则ID（如 design-004）
- ruleName：必须填写，对应上面代码审查规范中的规则名称（如 "魔法数字和字符串"）
- ruleLevel：必须填写，对应上面代码审查规范中的规则级别（"强卡控"/"建议"/"优化"）
- ruleDesc：必须填写，对应上面代码审查规范中的规则描述
- 这些字段的值必须与上面代码审查规范中对应规则的信息完全一致

**重要：每个问题必须单独一个评论，不要合并多个问题到一个评论中**
- 如果代码中有多个相同类型的问题（例如：多个魔法数字），每个问题都要单独创建一个评论
- 不要将多个问题合并成一个范围很大的评论（例如：不要将整个文件 121-1210 作为一个评论）

**重要：line 和 endLine 必须精确指向问题所在的具体位置（这是强制要求）**
- **必须使用 diff 中标记的行号**（每行代码前面的 +行号、-行号 或  行号），不能自己猜测或计算
- **必须仔细分析代码，找到问题出现的具体行号，不能使用文件最后一行或整个文件范围**
- 单行问题（如魔法数字、单个函数调用、接口定义等）：line 和 endLine 必须相同，指向问题所在的具体行号
  - 例如：如果看到 +37: interface IProps {，则 line: 37, endLine: 37
  - 例如：如果看到 +200: const value = 1722960000000;，则 line: 200, endLine: 200（注意：行号是200，不是1722960000000）
- 多行问题（如函数定义、代码块等）：line 是开始行号，endLine 是结束行号，必须精确到问题代码块的范围
  - 例如：函数定义从第 100 行开始到第 150 行结束，则 line: 100, endLine: 150
- **绝对禁止使用代码中的数字作为行号**（如魔法数字 1722960000000 不能作为行号）
- **绝对禁止使用文件最后一行作为 line 或 endLine**（除非问题确实在最后一行）
- **绝对禁止使用整个文件的范围**（如 line: 1, endLine: 1210），必须精确到具体问题所在的位置
- **对于组件长度、文件长度等整体性问题，应该指向组件定义开始的行号**（如 +50: const Component = () => { 中的 50），而不是文件最后一行

**重要：每个 comment 必须包含 endLine 字段（不能省略）**：
- 单行问题：endLine 必须等于 line（例如：接口定义在第 37 行，则 line: 37, endLine: 37）
- 多行问题：endLine 必须是结束行号（例如：函数定义在第 100-150 行，则 line: 100, endLine: 150）
- 评论会显示在 endLine 所在行的下方

如果没有发现问题，返回空的 comments 数组：{"comments": [], "summary": "..."}`;
}

/**
 * 审查单个文件批次（使用 JSON 输出方式）
 */
async function reviewFileBatch(
  fileBatch: FileDiff[],
  rulesText: string,
  rulesMap: Map<string, Rule>,
  systemPrompt: string,
  batchIndex: number,
  totalBatches: number,
  progressBar: cliProgress.SingleBar,
  totalFiles: number,
  processedFilesRef: { current: number },
  maxContinuations: number = 10
): Promise<{ comments: ReviewComment[]; success: boolean; error?: string }> {
  const prompt = buildReviewPrompt(fileBatch, rulesText);
  
  // 显示批次信息
  const batchFileNames = fileBatch.map(f => f.filePath).join(', ');
  console.log(chalk.gray(`\n📦 批次 ${batchIndex + 1}/${totalBatches} (${fileBatch.length} 个文件)`));
  console.log(chalk.gray(`   文件: ${batchFileNames}`));
  
  // 启动 loading 效果
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinnerIndex = 0;
  const loadingText = `正在审查批次 ${batchIndex + 1}/${totalBatches}...`;
  
  const spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;
    progressBar.update(processedFilesRef.current, {
      currentFile: `${spinnerChars[spinnerIndex]} ${loadingText}`,
    });
  }, 100);
  
  try {
    // 构建消息
    const messages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];
    
    // 调用 API 并确保 JSON 完整（最多续写 maxContinuations 次）
    console.log(chalk.blue(`  📡 ${batchIndex + 1}/${totalBatches} 开始调用 AI API...`));
    const apiStartTime = Date.now();
    const aiResponse = await callLLMAPIWithCompletion(messages, maxContinuations, batchIndex);
    const apiDuration = Date.now() - apiStartTime;
    console.log(chalk.gray(`  ⏱️  ${batchIndex + 1}/${totalBatches} AI API 调用总耗时: ${apiDuration}ms`));
    
    // 解析结果
    console.log(chalk.blue(`  🔍 ${batchIndex + 1}/${totalBatches} 开始解析 JSON 结果...`));
    const parseStartTime = Date.now();
    let result: ReviewResult;
    try {
      result = parseReviewResult(aiResponse, fileBatch, rulesMap);
    } catch (parseError) {
      const parseDuration = Date.now() - parseStartTime;
      console.error(chalk.red(`  ❌ ${batchIndex + 1}/${totalBatches} JSON 解析失败，耗时: ${parseDuration}ms`));
      console.error(chalk.red(`  错误: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
      throw new Error(`批次 ${batchIndex + 1} JSON 解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    const parseDuration = Date.now() - parseStartTime;
    console.log(chalk.gray(`  ⏱️  ${batchIndex + 1}/${totalBatches} JSON 解析耗时: ${parseDuration}ms`));
    
    // 检查是否达到最大续写次数但 JSON 仍不完整（通过检查响应中是否有警告信息）
    if (aiResponse.includes('达到最大续写次数') || aiResponse.includes('JSON 可能不完整')) {
      if (result.comments.length === 0) {
        throw new Error(`批次 ${batchIndex + 1} 达到最大续写次数但 JSON 仍不完整，且未解析出任何评论`);
      } else {
        console.warn(chalk.yellow(`  ⚠️  批次 ${batchIndex + 1} JSON 可能不完整，但已解析出 ${result.comments.length} 个评论`));
      }
    }
    
    // 更新进度
    processedFilesRef.current += fileBatch.length;
    
    // 更新进度条（移除 loading 效果）
    progressBar.update(processedFilesRef.current, {
      currentFile: `批次 ${batchIndex + 1} 完成`,
    });
    
    // 输出批次执行结果
    const errorCount = result.comments.filter(c => c.severity === 'error').length;
    const warningCount = result.comments.filter(c => c.severity === 'warning').length;
    const infoCount = result.comments.filter(c => c.severity === 'info').length;
    
    console.log(chalk.green(`  ✓ 批次 ${batchIndex + 1}/${totalBatches} 完成，发现 ${result.comments.length} 个评论 (${errorCount} 错误, ${warningCount} 警告, ${infoCount} 信息)`));
    console.log(chalk.gray(`   已审查文件: ${batchFileNames}`));
    
    return {
      comments: result.comments,
      success: true,
    };
  } catch (error) {
    // 批次执行失败
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`  ❌ 批次 ${batchIndex + 1}/${totalBatches} 执行失败: ${errorMessage}`));
    
    return {
      comments: [],
      success: false,
      error: errorMessage,
    };
  } finally {
    // 清除定时器
    clearInterval(spinnerInterval);
  }
}

/**
 * 过滤文件列表，只保留需要审查的文件
 */
function filterReviewFiles(fileDiffs: FileDiff[]): FileDiff[] {
  // 允许的文件扩展名
  const allowedExtensions = ['.ts', '.tsx'];
  
  return fileDiffs.filter(fileDiff => {
    const filePath = fileDiff.filePath.toLowerCase();
    // 检查文件扩展名
    return allowedExtensions.some(ext => filePath.endsWith(ext));
  });
}

/**
 * 格式化耗时（毫秒转可读格式）
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * 对代码进行审查（按文件逐个审查，支持进度显示）
 */
export async function reviewCode(fileDiffs: FileDiff[], additionalRuleFiles: string[] = [], maxContinuations: number = 10): Promise<ReviewResult> {
  // 记录开始时间
  const startTime = new Date();
  const startTimeISO = startTime.toISOString();
  console.log(chalk.blue(`\n🚀 代码审查开始时间: ${startTime.toLocaleString('zh-CN')}`));
  
  // 过滤文件，只审查 ts、tsx 文件
  const filteredFileDiffs = filterReviewFiles(fileDiffs);
  
  if (filteredFileDiffs.length === 0) {
    const skippedCount = fileDiffs.length - filteredFileDiffs.length;
    if (fileDiffs.length > 0) {
      console.log(chalk.yellow(`⚠️  已过滤 ${fileDiffs.length} 个文件（只审查 .ts 和 .tsx 文件）`));
    }
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    return {
      comments: [],
      summary: '没有需要审查的代码变更（已过滤非 TypeScript 文件）',
      startTime: startTimeISO,
      endTime: endTime.toISOString(),
      duration,
    };
  }
  
  // 如果有文件被过滤，显示提示
  if (filteredFileDiffs.length < fileDiffs.length) {
    const skippedCount = fileDiffs.length - filteredFileDiffs.length;
    console.log(chalk.gray(`📝 已过滤 ${skippedCount} 个非 TypeScript 文件，将审查 ${filteredFileDiffs.length} 个文件\n`));
  }

  // 加载审查规范
  console.log(chalk.blue('📚 加载审查规范...'));
  const loadRulesStartTime = Date.now();
  const { rulesText, rulesMap } = await loadReviewRules(additionalRuleFiles);
  const loadRulesDuration = Date.now() - loadRulesStartTime;
  console.log(chalk.gray(`  ✓ 审查规范加载完成，耗时: ${formatDuration(loadRulesDuration)}`));
  
  // 构建系统提示词
  console.log(chalk.blue('🔧 构建系统提示词...'));
  const systemPrompt = buildSystemPrompt();
  
  // 将文件拆分成多个批次（根据上下文大小）
  console.log(chalk.blue('📦 拆分文件批次...'));
  const batches = splitFilesIntoBatches(filteredFileDiffs, rulesText, systemPrompt);
  console.log(chalk.blue(`\n📋 开始代码审查：共 ${filteredFileDiffs.length} 个文件，分为 ${batches.length} 个批次\n`));
  
  // 创建进度条（总体进度）
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} 文件 | 当前: {currentFile}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
  
  progressBar.start(filteredFileDiffs.length, 0, {
    currentFile: '准备中...',
  });
  
  // 全局评论数组
  const allComments: ReviewComment[] = [];
  const processedFilesRef = { current: 0 };
  
  // 存储失败的批次信息
  interface FailedBatch {
    batchIndex: number;
    batch: FileDiff[];
    error: string;
  }
  const failedBatches: FailedBatch[] = [];
  
  // 逐个批次审查
  console.log(chalk.blue('🔄 开始批次审查...\n'));
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchStartTime = Date.now();
    
    console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(chalk.cyan(`批次 ${batchIndex + 1}/${batches.length} 开始审查 (${batch.length} 个文件)`));
    console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    
    // 审查当前批次
    const result = await reviewFileBatch(
      batch,
      rulesText,
      rulesMap,
      systemPrompt,
      batchIndex,
      batches.length,
      progressBar,
      filteredFileDiffs.length,
      processedFilesRef,
      maxContinuations
    );
    
    const batchDuration = Date.now() - batchStartTime;
    
    if (result.success) {
      // 批次成功，添加评论
      allComments.push(...result.comments);
      console.log(chalk.green(`✓ 批次 ${batchIndex + 1}/${batches.length} 审查成功，耗时: ${formatDuration(batchDuration)}\n`));
    } else {
      // 批次失败，记录失败信息，继续下一个批次
      console.error(chalk.red(`✗ 批次 ${batchIndex + 1}/${batches.length} 审查失败，耗时: ${formatDuration(batchDuration)}`));
      console.error(chalk.red(`  失败原因: ${result.error || '未知错误'}\n`));
      failedBatches.push({
        batchIndex,
        batch,
        error: result.error || '未知错误',
      });
    }
  }
  
  // 如果有失败的批次，再试一次
  if (failedBatches.length > 0) {
    console.log(chalk.yellow(`\n⚠️  有 ${failedBatches.length} 个批次执行失败，开始重试...\n`));
    
    for (let retryIndex = 0; retryIndex < failedBatches.length; retryIndex++) {
      const failedBatch = failedBatches[retryIndex];
      const retryStartTime = Date.now();
      
      console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
      console.log(chalk.cyan(`🔄 重试批次 ${failedBatch.batchIndex + 1}/${batches.length} (${failedBatch.batch.length} 个文件)`));
      console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
      console.log(chalk.yellow(`  上次失败原因: ${failedBatch.error}`));
      
      const retryResult = await reviewFileBatch(
        failedBatch.batch,
        rulesText,
        rulesMap,
        systemPrompt,
        failedBatch.batchIndex,
        batches.length,
        progressBar,
        filteredFileDiffs.length,
        processedFilesRef,
        maxContinuations
      );
      
      const retryDuration = Date.now() - retryStartTime;
      
      if (retryResult.success) {
        // 重试成功
        allComments.push(...retryResult.comments);
        console.log(chalk.green(`✓ 批次 ${failedBatch.batchIndex + 1} 重试成功，耗时: ${formatDuration(retryDuration)}\n`));
      } else {
        // 重试仍然失败，标记文件失败
        console.error(chalk.red(`✗ 批次 ${failedBatch.batchIndex + 1} 重试仍然失败，耗时: ${formatDuration(retryDuration)}`));
        console.error(chalk.red(`  失败原因: ${retryResult.error || failedBatch.error}`));
        console.error(chalk.red(`  失败文件: ${failedBatch.batch.map(f => f.filePath).join(', ')}\n`));
      }
    }
  }
  
  // 完成进度条
  progressBar.stop();
  
  // 记录结束时间
  const endTime = new Date();
  const endTimeISO = endTime.toISOString();
  const duration = endTime.getTime() - startTime.getTime();
  
  // 生成总结
  const errorCount = allComments.filter(c => c.severity === 'error').length;
  const warningCount = allComments.filter(c => c.severity === 'warning').length;
  const infoCount = allComments.filter(c => c.severity === 'info').length;
  
  const summary = `代码审查完成。共审查 ${filteredFileDiffs.length} 个文件，发现 ${allComments.length} 个问题：${errorCount} 个错误，${warningCount} 个警告，${infoCount} 个建议。`;
  
  console.log(chalk.cyan(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
  console.log(chalk.green(`✅ 审查完成！`));
  console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
  console.log(chalk.gray(`   开始时间: ${startTime.toLocaleString('zh-CN')}`));
  console.log(chalk.gray(`   结束时间: ${endTime.toLocaleString('zh-CN')}`));
  console.log(chalk.gray(`   总耗时: ${formatDuration(duration)}`));
  console.log(chalk.gray(`   总文件数: ${filteredFileDiffs.length}`));
  console.log(chalk.gray(`   总评论数: ${allComments.length}`));
  if (errorCount > 0) {
    console.log(chalk.red(`   错误: ${errorCount}`));
  }
  if (warningCount > 0) {
    console.log(chalk.yellow(`   警告: ${warningCount}`));
  }
  if (infoCount > 0) {
    console.log(chalk.blue(`   建议: ${infoCount}`));
  }
  if (failedBatches.length > 0) {
    console.log(chalk.red(`   失败批次: ${failedBatches.length}`));
  }
  console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`));
  
  return {
    comments: allComments,
    summary,
    startTime: startTimeISO,
    endTime: endTimeISO,
    duration,
  };
}

