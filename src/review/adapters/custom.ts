import OpenAI from 'openai';
import chalk from 'chalk';
import type { LLMAdapter, LLMMessage, LLMRequestOptions, LLMResponse } from './base.js';
import { t } from '../../utils/i18n.js';

/**
 * 自定义 API 模型的最大上下文长度（tokens）
 * 默认使用 DeepSeek 的限制
 */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'deepseek-chat': 131072,
  'deepseek-coder': 131072,
  // 默认值（DeepSeek 的限制）
  'default': 131072,
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

export class CustomAdapter implements LLMAdapter {
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

    if (!baseUrl) {
      throw new Error('LLM_BASE_URL is required for custom provider');
    }

    const requestStartTime = Date.now();
    console.log(chalk.gray(`      ${t('adapter.custom.httpCall', { baseUrl, maxTokens })}`));

    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    try {
      const response = await client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature,
        max_tokens: maxTokens, // 使用 max_tokens 而不是 max_completion_tokens
      });

      const requestDuration = Date.now() - requestStartTime;
      console.log(chalk.gray(`      ${t('adapter.custom.apiComplete', { duration: requestDuration })}`));

      const content = response.choices[0]?.message?.content || '';
      if (!content) {
        throw new Error('No content in custom API response');
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
      console.error(chalk.red(`      ${t('adapter.custom.requestFailed', { duration: requestDuration })}`));
      
      if (error instanceof OpenAI.APIError) {
        console.error(chalk.red(`      ${t('adapter.custom.errorDetails')} ${error.status} ${error.message}`));
        if (error.error) {
          const errorStr = typeof error.error === 'string' 
            ? error.error 
            : JSON.stringify(error.error);
          console.error(chalk.red(`      ${t('adapter.custom.errorContent')} ${errorStr.substring(0, 500)}`));
        }
        throw new Error(`Custom API error: ${error.status} ${error.message}`);
      }
      throw error;
    }
  }
}


