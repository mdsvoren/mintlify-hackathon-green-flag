import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.js";
import {
  FileWithRangeAndDescription,
  FileWithUpdatedContent,
} from "./types/file.js";
import { isLintRule, LintRule } from "./types/lintRule.js";
import { ContentBlock } from "@anthropic-ai/sdk/resources/index.mjs";

export class ClaudeSonnetClient {
  private client: Anthropic;

  constructor(apiKey: string = env.ANTHROPIC_API_KEY) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  async invokeModelWithCode(
    files: FileWithRangeAndDescription[]
  ): Promise<FileWithUpdatedContent[]> {
    const prompt = this.createPrompt(files);

    try {
      const message = await this.client.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });

      // Parse the LLM output and coerce it into FileWithUpdatedContent[]
      return this.contentToFiles(message.content);
    } catch (error) {
      console.error("Error invoking Claude Sonnet 3.5:", error);
      return [];
    }
  }

  async getStructuredLintRule(lintRule: string): Promise<LintRule> {
    const prompt = `
    You are tasked with converting a natural language lint rule into a structured format that can be used to search for and modify relevant code files. The input will be a lint rule described in plain English, and your job is to generate a JSON object with specific fields that represent how to find and modify the relevant code.

Here is the natural language lint rule you will be working with:
<lint_rule>
{{LINT_RULE}}
</lint_rule>

Your output should be a JSON object with the following structure:
{
  "targetQuery": String,
  "filter": {
    "beforeDate": ISO Date String (optional),
    "afterDate": ISO Date String (optional),
    "fileGlob": String (optional)
  },
  "actionPrompt": String
}

Follow these steps to generate the required output:

1. Analyze the lint rule to understand its requirements and implications.

2. Create a \`targetQuery\` string that would be used for a semantic search over a codebase to find relevant input files. This should be a description of the type of code or files that the rule applies to.

3. Determine if any filters should be applied to the search results. If applicable, add one or more of the following to the \`filter\` object:
   - \`beforeDate\`: If the rule applies to code before a certain date
   - \`afterDate\`: If the rule applies to code after a certain date
   - \`fileGlob\`: If the rule applies to specific file types or naming patterns

4. Craft an \`actionPrompt\` string that instructs an LLM on how to modify the files found by the \`targetQuery\`. This should clearly explain what changes need to be made to comply with the lint rule, but don't include any of the filter in this string as the files will be filtered prior to sending them to the LLM.

Here are two examples of good outputs:

Example 1:
Input: "All React components should use functional syntax instead of class syntax"
Output:
{
  "targetQuery": "React component using class syntax",
  "filter": {
    "fileGlob": "*.jsx,*.tsx"
  },
  "actionPrompt": "Convert the React class component to a functional component using hooks. Ensure that all lifecycle methods and state are properly translated to their functional equivalents."
}

Example 2:
Input: "Deprecated 'moment' library usage should be replaced with 'date-fns' in all JavaScript files modified after January 1, 2023"
Output:
{
  "targetQuery": "import or require statement for 'moment' library",
  "filter": {
    "afterDate": "2023-01-01",
    "fileGlob": "*.js,*.ts"
  },
  "actionPrompt": "Replace all usage of the 'moment' library with equivalent functions from the 'date-fns' library. Update import statements and refactor any moment-specific method calls to their date-fns counterparts."
}

Now, analyze the provided lint rule and generate the appropriate JSON object. Ensure that your \`targetQuery\` is specific enough to find relevant code, your \`filter\` (if needed) accurately reflects any time or file type constraints, and your \`actionPrompt\` gives clear instructions on how to modify the code to comply with the rule.

The current date is 9/8/2024.



Only return the JSON response as your output, nothing else.
    `;

    try {
      const message = await this.client.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });

      const response = JSON.parse(
        (message.content[0] as { text: string }).text
      );
      if (isLintRule(response)) {
        return response;
      } else {
        throw new Error("Response does not match LintRule type");
      }
    } catch (error) {
      console.error("Error invoking Claude Sonnet 3.5:", error);
      throw error;
    }
  }

  async invokeModelWithLintRule(
    files: FileWithRangeAndDescription[],
    rule: LintRule
  ): Promise<FileWithUpdatedContent[]> {
    const prompt = `
    Perform the following action on the codebase:
    ${rule.actionPrompt}


    The output should be an array of objects with the following shape:
    {
      "path": "path/to/file.ts",
      "updatedContent": "updated content"
    }

    
    The files to be modified are:
    ${files.map((file) => `\nFile: ${file.path}\nRelevant Range: ${file.range.start}-${file.range.end}\nContent: ${file.content}`).join("\n")}
    `;

    try {
      const message = await this.client.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });

      return this.contentToFiles(message.content);
    } catch (error) {
      console.error("Error invoking Claude Sonnet 3.5:", error);
      return [];
    }
  }

  private createPrompt(files: FileWithRangeAndDescription[]): string {
    const prompt = `
      The following are some files and ranges within each. They correspond to feature flags that should be removed.
      Please provide the updated content for each file with the feature flag and its dependent code removed in JSON format. 
      The updated content should be a string containing the original content with the feature flag and its dependent code removed.
      Don't include any other text or formatting.
      Don't modify file content unrelated to the feature flag.
      Don't remove any underlying feature flag services/classes/methods/providers etc.
      Make sure to consider the dependencies between files when removing the feature flag.

      The output should be an array of objects with the following shape:
      [
        {
        "path": "path/to/file.ts",
        "updatedContent": "updated content"
      }

      ${files
        .map(
          (file) => `
        File: ${file.path}
        Range: ${file.range.start}-${file.range.end}
        Flag Name: ${file.description}
        Content:
        ${file.content}
      `
        )
        .join("\n\n")}
    `;

    console.log(`Prompt: ${prompt}`);
    return prompt;
  }

  private contentToFiles(content: ContentBlock[]): FileWithUpdatedContent[] {
    return content
      .filter(
        (block): block is { type: "text"; text: string } =>
          block.type === "text"
      )
      .flatMap((block) => {
        try {
          const parsed = JSON.parse(block.text);
          if (Array.isArray(parsed)) {
            return parsed.filter(
              (item): item is FileWithUpdatedContent =>
                typeof item === "object" &&
                "path" in item &&
                "updatedContent" in item &&
                typeof item.path === "string" &&
                typeof item.updatedContent === "string"
            );
          } else if (typeof parsed === "object" && parsed !== null) {
            const item = parsed as unknown;
            if (
              "path" in parsed &&
              "updatedContent" in parsed &&
              typeof parsed.path === "string" &&
              typeof parsed.updatedContent === "string"
            ) {
              return [parsed as FileWithUpdatedContent];
            }
          }
        } catch (e) {
          console.error("Error parsing LLM output:", e);
        }
        return [];
      });
  }
}
