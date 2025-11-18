import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import type { LLMAdapter, LLMMessage, LLMRequestOptions, LLMResponse } from './base.js';

/**
 * Anthropic 模型的最大上下文长度（tokens）
 */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-haiku-20241022': 200000,
  // 默认值
  'default': 200000,
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

export class AnthropicAdapter implements LLMAdapter {
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
    console.log(chalk.gray(`      [SDK] 使用 Anthropic SDK 调用 API (maxTokens: ${maxTokens})...`));

    const client = new Anthropic({
      apiKey,
    });

    // Anthropic 需要将 system 消息单独处理
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    // 转换消息格式：Anthropic 使用 'user' 和 'assistant' 角色
    const anthropicMessages: Anthropic.MessageParam[] = conversationMessages.map(msg => {
      if (msg.role === 'user') {
        return { role: 'user', content: msg.content };
      } else if (msg.role === 'assistant') {
        return { role: 'assistant', content: msg.content };
      } else {
        // 其他角色转换为 user
        return { role: 'user', content: msg.content };
      }
    });

    const requestParams: Anthropic.Messages.MessageCreateParams = {
      model: model as Anthropic.MessageCreateParams['model'],
      messages: anthropicMessages,
      temperature,
      max_tokens: maxTokens,
    };

    if (systemMessages.length > 0) {
      requestParams.system = systemMessages.map((m) => m.content).join('\n\n');
    }

    try {
      const response = await client.messages.create(requestParams);

      const requestDuration = Date.now() - requestStartTime;
      console.log(chalk.gray(`      [SDK] API 调用完成，耗时: ${requestDuration}ms`));

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
      if (!content) {
        throw new Error('No content in Anthropic response');
      }

      return {
        content,
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        } : undefined,
      };
    } catch (error) {
      const requestDuration = Date.now() - requestStartTime;
      console.error(chalk.red(`      [SDK] 请求失败，耗时: ${requestDuration}ms`));
      
      if (error instanceof Anthropic.APIError) {
        console.error(chalk.red(`      [SDK] 错误详情: ${error.status} ${error.message}`));
        if (error.error) {
          console.error(chalk.red(`      [SDK] 错误内容: ${JSON.stringify(error.error).substring(0, 500)}`));
        }
        throw new Error(`Anthropic API error: ${error.status} ${error.message}`);
      }
      throw error;
    }
  }
}

