import OpenAI from 'openai';
import chalk from 'chalk';
import type { LLMAdapter, LLMMessage, LLMRequestOptions, LLMResponse } from './base.js';
import { t } from '../../utils/i18n.js';

/**
 * OpenAI 模型的最大上下文长度（tokens）
 * 注意：如果使用 DeepSeek 等自定义 API，应该使用 custom provider
 */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4-0125-preview': 128000,
  'gpt-4-1106-preview': 128000,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'gpt-3.5-turbo-1106': 16385,
  'gpt-3.5-turbo-0125': 16385,
  // DeepSeek 模型（如果误用 openai provider，至少使用正确的上下文限制）
  'deepseek-chat': 131072,
  'deepseek-coder': 131072,
  // 默认值
  'default': 16385,
};

/**
 * 改进的 token 估算
 * - 英文/代码：约 4 个字符 = 1 token
 * - 中文：约 1.5 个字符 = 1 token
 * - 混合内容：使用加权平均
 */
function estimateTokens(messages: LLMMessage[]): number {
  let totalTokens = 0;
  
  for (const msg of messages) {
    const content = msg.content;
    // 估算中文字符数（CJK 统一表意文字范围）
    const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = content.length - chineseChars;
    
    // 中文：1.5 字符/token，其他：4 字符/token
    const chineseTokens = Math.ceil(chineseChars / 1.5);
    const otherTokens = Math.ceil(otherChars / 4);
    
    // 加上角色和格式开销（约 10 tokens）
    totalTokens += chineseTokens + otherTokens + 10;
  }
  
  return totalTokens;
}

export class OpenAIAdapter implements LLMAdapter {
  estimateTokens(messages: LLMMessage[]): number {
    return estimateTokens(messages);
  }

  getMaxContextLength(model: string): number {
    return MODEL_CONTEXT_LIMITS[model] || MODEL_CONTEXT_LIMITS['default'];
  }

  async call(options: LLMRequestOptions): Promise<LLMResponse> {
    const {
      apiKey,
      baseUrl,
      model,
      messages,
      temperature = 0.3,
      maxTokens = 8192,
    } = options;

    const requestStartTime = Date.now();
    // OpenAI SDK 会自动添加 /chat/completions，所以 baseURL 不应该包含这个路径
    // 如果 baseUrl 包含 /chat/completions，需要移除它
    let normalizedBaseUrl = baseUrl || 'https://api.openai.com/v1';
    if (normalizedBaseUrl.endsWith('/chat/completions')) {
      normalizedBaseUrl = normalizedBaseUrl.replace(/\/chat\/completions\/?$/, '');
      console.log(chalk.yellow(`      ${t('adapter.openai.baseUrlWarning', { baseUrl: normalizedBaseUrl })}`));
    }
    
    console.log(chalk.gray(`      ${t('adapter.openai.sdkCall', { baseUrl: normalizedBaseUrl, maxTokens })}`));

    const client = new OpenAI({
      apiKey,
      baseURL: normalizedBaseUrl,
    
    });

    try {
      const response = await client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature,
        
        max_tokens: maxTokens, // 使用 max_tokens 而不是 max_completion_tokens
      });

      const requestDuration = Date.now() - requestStartTime;
      console.log(chalk.gray(`      ${t('adapter.apiComplete', { duration: requestDuration })}`));

      const content = response.choices[0]?.message?.content || '';
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      return {
        content,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      const requestDuration = Date.now() - requestStartTime;
      console.error(chalk.red(`      ${t('adapter.requestFailed', { duration: requestDuration })}`));
      
      if (error instanceof OpenAI.APIError) {
        console.error(chalk.red(`      ${t('adapter.errorDetails')} ${error.status} ${error.message}`));
        if (error.error) {
          console.error(chalk.red(`      ${t('adapter.errorContent')} ${JSON.stringify(error.error).substring(0, 500)}`));
        }
        throw new Error(`OpenAI API error: ${error.status} ${error.message}`);
      }
      throw error;
    }
  }
}


