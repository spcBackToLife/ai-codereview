export interface LLMMessage {
  role: string;
  content: string;
}

export interface LLMRequestOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMAdapter {
  /**
   * 调用 LLM API
   */
  call(options: LLMRequestOptions): Promise<LLMResponse>;
  
  /**
   * 估算消息的 token 数量
   */
  estimateTokens(messages: LLMMessage[]): number;
  
  /**
   * 获取模型的最大上下文长度
   */
  getMaxContextLength(model: string): number;
}


