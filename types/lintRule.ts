export type LintRule = {
  targetQuery: string;
  filter?: FileFilter;
  actionPrompt: string;
};

type FileFilter = {
  beforeDate?: String;
  afterDate?: String;
  fileGlob?: String;
};

export function isLintRule(obj: any): obj is LintRule {
  return (
    typeof obj === "object" &&
    typeof obj.targetQuery === "string" &&
    (obj.filter === undefined || typeof obj.filter === "object") &&
    typeof obj.actionPrompt === "string"
  );
}
