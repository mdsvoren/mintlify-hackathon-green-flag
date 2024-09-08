import Anthropic from '@anthropic-ai/sdk';
import { env } from "./env.js";
import { FileWithRange, FileWithUpdatedContent } from './types/file.js';

export class ClaudeSonnetClient {
  private client: Anthropic;

  constructor(apiKey: string = env.ANTHROPIC_API_KEY) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  async invokeModelWithCode(files: FileWithRange[]): Promise<FileWithUpdatedContent[]> {
    const prompt = this.createPrompt(files);

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      });

      // Parse the LLM output and coerce it into FileWithUpdatedContent[]
      const updatedFiles: FileWithUpdatedContent[] = message.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .flatMap((block) => {
          try {
            const parsed = JSON.parse(block.text);
            if (Array.isArray(parsed)) {
              return parsed.filter((item): item is FileWithUpdatedContent => 
                typeof item === 'object' && 
                'path' in item && 
                'updatedContent' in item &&
                typeof item.path === 'string' &&
                typeof item.updatedContent === 'string'
              );
            } else if (typeof parsed === 'object' && parsed !== null) {
              const item = parsed as unknown;
              if ('path' in parsed && 'updatedContent' in parsed &&
                  typeof parsed.path === 'string' &&
                  typeof parsed.updatedContent === 'string') {
                return [parsed as FileWithUpdatedContent];
              }
            }
          } catch (e) {
            console.error('Error parsing LLM output:', e);
          }
          return [];
        });

      return updatedFiles;
    } catch (error) {
      console.error('Error invoking Claude Sonnet 3.5:', error);
      return [];
    }
  }

  private createPrompt(files: FileWithRange[]): string {
    return `
      The following are some files and ranges within each. They correspond to feature flags that should be removed.
      Please provide the updated content for each file with the feature flag and its dependent code removed in JSON format. 
      The updated content should be a string containing the original content with the feature flag and its dependent code removed.
      Don't include any other text or formatting.
      Don't modify file content unrelated to the feature flag.
      Make sure to consider the dependencies between files when removing the feature flag.

      The output should be an array of objects with the following shape:
      [
        {
        "path": "path/to/file.ts",
        "updatedContent": "updated content"
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