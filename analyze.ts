import { fetchFeatureFlags, FeatureFlag } from './greptile.js';
import { getSnippetChangeDate } from './blame.js';
import { Octokit } from 'octokit';

export async function analyzeFeatureFlags(octokit: Octokit, repository: string, branch: string, owner: string) {
  try {
    // Fetch feature flags
    const featureFlags: FeatureFlag[] = await fetchFeatureFlags(repository, branch);

    // Analyze each feature flag
    for (const flag of featureFlags) {
      flag.change_date = await getSnippetChangeDate({
        client: octokit,
        owner,
        repo: repository,
        ref: branch,
        filePath: flag.file_path,
        startLine: flag.line_start,
        endLine: flag.line_end
      });

      console.log(`Feature flag in ${flag.file_path} (lines ${flag.line_start}-${flag.line_end}) last changed on: ${flag.change_date}`);
    }
  } catch (error) {
    console.error('Error analyzing feature flags:', error);
  }
}
