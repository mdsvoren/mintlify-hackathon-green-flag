import { fetchFeatureFlags, FeatureFlag } from "./greptile.js";
import { getSnippetChangeDate } from "./blame.js";
import { Octokit } from "octokit";
import { FileWithRange } from "./types/file.js";
import { ClaudeSonnetClient } from "./anthropic-client.js";
import { getBlob, getOctokit } from "./github-app.js";

export async function analyzeFeatureFlags(
  octokit: Octokit,
  anthropicClient: ClaudeSonnetClient,
  repository: string,
  branch: string,
  owner: string
) {
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
        `Feature flag in ${flag.file_path} (lines ${flag.line_start}-${flag.line_end}) last changed on: ${flag.change_date}`
      );
    }

    // Filter feature flags to keep only those newer than 2 months old
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const recentFeatureFlags = featureFlags.filter(
      (flag) => flag.change_date && flag.change_date < twoMonthsAgo
    );

    console.log(
      `Number of feature flags newer than 2 months: ${recentFeatureFlags.length}`
    );

    const fileContentMap = new Map<string, string>();

    for (const flag of recentFeatureFlags) {
      const content = await getBlob(octokit, owner, repository, flag.file_path);
      fileContentMap.set(flag.file_path, content);
    }

    const fileWithRanges: FileWithRange[] = recentFeatureFlags.map((flag) => ({
      path: flag.file_path,
      content: fileContentMap.get(flag.file_path) ?? "",
      range: {
        start: flag.line_start || 0,
        end: flag.line_end || 0,
      },
    }));

    console.log(
      `Number of FileWithRange objects created: ${fileWithRanges.length}`
    );

    return fileWithRanges;
  } catch (error) {
    console.error("Error analyzing feature flags:", error);
    return [];
  }
}
