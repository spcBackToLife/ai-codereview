import OpenAI from 'openai';
import chalk from 'chalk';
import type { LLMAdapter, LLMMessage, LLMRequestOptions, LLMResponse } from './base.js';

/**
 * 月之暗面模型的最大上下文长度（tokens）
 */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'moonshot-v1-8k': 8192,
  'moonshot-v1-32k': 32768,
  'moonshot-v1-128k': 131072,
  // 默认值
  'default': 32768,
};

/**
 * 简单的 token 估算（约 4 个字符 = 1 token）
 */
function estimateTokens(messages: LLMMessage[]): number {
  const totalChars = messages.reduce((sum, msg) => {
    return sum + msg.content.length + (msg.role.length + 10);
  }, 0);
  return Math.ceil(totalChars / 4);
}

export class MoonshotAdapter implements LLMAdapter {
  estimateTokens(messages: LLMMessage[]): number {
    return estimateTokens(messages);
  }

  getMaxContextLength(model: string): number {
    return MODEL_CONTEXT_LIMITS[model] || MODEL_CONTEXT_LIMITS['default'];
  }

  async call(options: LLMRequestOptions): Promise<LLMResponse> {
    const {
      apiKey,
      model,
      messages,
      temperature = 0.3,
      maxTokens = 8192,
    } = options;

    const requestStartTime = Date.now();
    console.log(chalk.gray(`      [SDK] 使用 OpenAI SDK (兼容格式) 调用 Moonshot API (maxTokens: ${maxTokens})...`));

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.moonshot.cn/v1',
    });

    try {
      const response = await client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature,
        max_tokens: maxTokens, // 使用 max_tokens 而不是 max_completion_tokens
      });

      const requestDuration = Date.now() - requestStartTime;
      console.log(chalk.gray(`      [SDK] API 调用完成，耗时: ${requestDuration}ms`));

      const content = response.choices[0]?.message?.content || '';
      if (!content) {
        throw new Error('No content in Moonshot response');
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
      console.error(chalk.red(`      [SDK] 请求失败，耗时: ${requestDuration}ms`));
      
      if (error instanceof OpenAI.APIError) {
        console.error(chalk.red(`      [SDK] 错误详情: ${error.status} ${error.message}`));
        if (error.error) {
          console.error(chalk.red(`      [SDK] 错误内容: ${JSON.stringify(error.error).substring(0, 500)}`));
        }
        throw new Error(`Moonshot API error: ${error.status} ${error.message}`);
      }
      throw error;
    }
  }
}

