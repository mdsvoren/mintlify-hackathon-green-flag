import {
  fetchFeatureFlags,
  FeatureFlag,
  fetchFeatureFlagUsage,
  fetchRelevantCode,
} from "./greptile.js";
import { getSnippetChangeDate } from "./blame.js";
import { Octokit } from "octokit";
import { FileWithRangeAndDescription } from "./types/file.js";
import { ClaudeSonnetClient } from "./anthropic-client.js";
import { getBlob, getOctokit } from "./github-app.js";
import { LintRule } from "./types/lintRule.js";

export async function analyzeFeatureFlags(
  octokit: Octokit,
  anthropicClient: ClaudeSonnetClient,
  repository: string,
  branch: string,
  owner: string
) {
  let fileWithRanges: FileWithRangeAndDescription[] = [];

  try {
    // Fetch feature flags
    const featureFlags: FeatureFlag[] = await fetchFeatureFlags(
      owner,
      repository,
      branch
    );

    if (featureFlags.length === 0) {
      console.log("No feature flags found");
      return [];
    }

    // Analyze each feature flag
    for (const flag of featureFlags) {
      flag.change_date = await getSnippetChangeDate({
        client: octokit,
        owner,
        repo: repository,
        ref: branch,
        filePath: flag.file_path,
        startLine: flag.line_start,
        endLine: flag.line_end,
      });

      console.log(
        `Feature flag ${flag.feature_flag_name} in ${flag.file_path} (lines ${flag.line_start}-${flag.line_end}) last changed on: ${flag.change_date}`
      );
    }

    // Filter feature flags to keep only those newer than 2 months old
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const staleFeatureFlags = featureFlags.filter(
      (flag) => flag.change_date && flag.change_date < twoMonthsAgo
    );

    console.log(
      `Number of feature flags older than 2 months: ${staleFeatureFlags.length}`
    );

    // Fetch feature flag usage for stale feature flags
    const featureFlagUsage = await fetchFeatureFlagUsage(
      owner,
      repository,
      branch,
      staleFeatureFlags
    );

    // You might want to associate usage with each stale feature flag here
    // For example:
    staleFeatureFlags.forEach((flag) => {
      flag.usages = featureFlagUsage.filter(
        (usage) => usage.feature_flag_name === flag.feature_flag_name
      );
    });

    const fileContentMap = new Map<string, string>();

    for (const flag of staleFeatureFlags) {
      const content = await getBlob(octokit, owner, repository, flag.file_path);
      fileContentMap.set(flag.file_path, content);
    }

    fileWithRanges = staleFeatureFlags.map((flag) => ({
      path: flag.file_path,
      content: fileContentMap.get(flag.file_path) ?? "",
      range: {
        start: flag.line_start || 0,
        end: flag.line_end || 0,
      },
      description: flag.feature_flag_name,
    }));

    // Append usage data to fileWithRanges
    for (const flag of staleFeatureFlags) {
      if (flag.usages) {
        for (const usage of flag.usages) {
          const content = await getBlob(
            octokit,
            owner,
            repository,
            usage.file_path
          );
          fileWithRanges.push({
            path: usage.file_path,
            content: content,
            range: {
              start: usage.line_start,
              end: usage.line_end,
            },
            description: flag.feature_flag_name,
          });
        }
      }
    }

    return fileWithRanges;
  } catch (error) {
    console.error("Error analyzing feature flags:", error);
    return [];
  }
}

export const analyzeWithLintRule = async (
  octokit: Octokit,
  owner: string,
  repository: string,
  branch: string,
  rule: LintRule
) => {
  const relevantCode = await fetchRelevantCode(
    owner,
    repository,
    branch,
    rule.targetQuery
  );

  const fileContentMap = new Map<string, string>();

  for (const code of relevantCode) {
    const content = await getBlob(octokit, owner, repository, code.file_path);
    fileContentMap.set(code.file_path, content);
  }

  const fileWithRanges: FileWithRangeAndDescription[] = relevantCode.map(
    (code) => ({
      path: code.file_path,
      content: fileContentMap.get(code.file_path) ?? "",
      range: {
        start: code.line_start,
        end: code.line_end,
      },
    })
  );

  return fileWithRanges;
};
