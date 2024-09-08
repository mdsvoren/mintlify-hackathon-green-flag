import Anthropic from '@anthropic-ai/sdk';
import { env } from "./env.js";

class ClaudeSonnetClient {
  private client: Anthropic;

  constructor(apiKey: string = env.ANTHROPIC_API_KEY) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  async invokeModelWithCode(code: string): Promise<void> {
    const prompt = this.createPrompt(code);

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      });

      console.log(message.content);
    } catch (error) {
      console.error('Error invoking Claude Sonnet 3.5:', error);
    }
  }

  private createPrompt(code: string): string {
    return `Here is some code:\n\n${code}\n\nPlease provide any useful feedback, insights, or improvements.`;
  }
}