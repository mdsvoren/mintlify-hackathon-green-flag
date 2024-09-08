import Anthropic from '@anthropic-ai/sdk';
import { env } from "./env.js";
import { FileWithRange } from './types/file.js';

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

  private createPrompt(files: FileWithRange[]): string {
    return `
      The following are some files and ranges within each. They correspond to feature flags that should be removed.
      Please provide the updated content for each file with the feature flag and its dependent code removed in JSON format. e.g.:
      {
        "file_path": "path/to/file.ts",
        "updated_content": "updated content"
      }

      ${files.map(file => `
        File: ${file.path}
        Range: ${file.range.start}-${file.range.end}
        Content:
        ${file.content}
      `).join('\n\n')}
    `;
  }
}