import chalk from 'chalk';
import type { LLMAdapter, LLMMessage, LLMRequestOptions, LLMResponse } from './base.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { MoonshotAdapter } from './moonshot.js';
import { CustomAdapter } from './custom.js';

export type LLMProvider = 'openai' | 'anthropic' | 'moonshot' | 'custom';

/**
 * 获取 LLM Adapter
 */
export function getLLMAdapter(provider: LLMProvider): LLMAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter();
    case 'anthropic':
      return new AnthropicAdapter();
    case 'moonshot':
      return new MoonshotAdapter();
    case 'custom':
      return new CustomAdapter();
    default:
      throw new Error(`Unsupported LLM provider: ${provider}. Supported providers: openai, anthropic, moonshot, custom`);
  }
}

/**
 * 统一的 LLM API 调用接口
 */
export async function callLLMAPI(messages: LLMMessage[]): Promise<string> {
  const provider = (process.env.LLM_PROVIDER || 'openai') as LLMProvider;
  const modelName = process.env.LLM_MODEL_NAME || 'gpt-3.5-turbo';
  const apiKey = process.env.LLM_API_KEY || '';
  const baseUrl = process.env.LLM_BASE_URL;

  if (!apiKey) {
    throw new Error('LLM_API_KEY environment variable is not set. Please set it before running code review.');
  }

  const adapter = getLLMAdapter(provider);
  
  // 检查上下文长度限制
  const estimatedTokens = adapter.estimateTokens(messages);
  const maxContextLength = adapter.getMaxContextLength(modelName);
  const maxTokens = parseInt(process.env.LLM_MAX_TOKENS || '8192', 10);
  
  // 预留一些 token 给响应
  const availableTokens = maxContextLength - maxTokens - 1000; // 预留 1000 tokens 作为缓冲
  
  if (estimatedTokens > availableTokens) {
    throw new Error(
      `Context length exceeded: estimated ${estimatedTokens} tokens, but model ${modelName} ` +
      `has a maximum context length of ${maxContextLength} tokens. ` +
      `Available tokens after reserving ${maxTokens} for response: ${availableTokens}. ` +
      `Please reduce the input size or use a model with a larger context window.`
    );
  }

  console.log(chalk.gray(`      [配置] 提供商: ${provider}, 模型: ${modelName}`));
  console.log(chalk.gray(`      [配置] 估算 token 数: ${estimatedTokens}, 最大上下文: ${maxContextLength}, 可用: ${availableTokens}`));

  const options: LLMRequestOptions = {
    apiKey,
    baseUrl,
    model: modelName,
    messages,
    temperature: 0.3,
    maxTokens,
  };

  const response = await adapter.call(options);

  if (response.usage) {
    console.log(chalk.gray(`      [统计] Token 使用: 输入=${response.usage.promptTokens}, 输出=${response.usage.completionTokens}, 总计=${response.usage.totalTokens}`));
  }

  return response.content;
}

export type { LLMMessage, LLMRequestOptions, LLMResponse, LLMAdapter };

