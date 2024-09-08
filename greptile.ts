import { env } from "./env.js";

const greptile_api_key = env.GREPTILE_API_KEY;
const github_token = env.GITHUB_TOKEN;

if (!greptile_api_key || !github_token) {
  throw new Error("Missing required environment variables");
}

export interface FeatureFlag {
  file_path: string;
  line_start: number; // line number where the feature flag is defined
  line_end: number; // line number where the feature flag is defined
  feature_flag_name: string;
  change_date: Date | null;
  usages: FeatureFlagUsage[] | null;
}

export interface FeatureFlagUsage {
  file_path: string;
  line_start: number; // line number where the feature flag is used
  line_end: number; // line number where the feature flag is used
  feature_flag_name: string;
  snippet: string;
}

export interface RelevantCode {
  file_path: string;
  line_start: number;
  line_end: number;
}

export const fetchRelevantCode = async (
  owner: string,
  repository: string,
  branch: string,
  query: string
) => {
  try {
    const response = await fetch("https://api.greptile.com/v2/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${greptile_api_key}`,
        "X-Github-Token": github_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            id: "123456",
            content: `Find all the code in the repository that is relevant to the following query: ${query}. For each instance, provide a structured JSON object with the file_path, line_start, and line_end. Your response must contain an object we can load with JSON.parse(), without any additional text, formatting, or code blocks.`,
            role: "user",
          },
        ],
        repositories: [
          {
            remote: "github",
            branch,
            repository: `${owner}/${repository}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`HTTP error! response: ${await response.text()}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log(`Relevant code response: ${JSON.stringify(responseData, null, 2)}`);
    const relevantCodeData = JSON.parse(responseData.message);
    return relevantCodeData as RelevantCode[];
  } catch (err) {
    console.error("Error fetching relevant code:", err);
    throw err;
  }
};

// HACK: This function assumes the repository has been indexed by Greptile
export const fetchFeatureFlags = async (
  owner: string,
  repository: string,
  branch: string
): Promise<FeatureFlag[]> => {
  try {
    const response = await fetch("https://api.greptile.com/v2/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${greptile_api_key}`,
        "X-Github-Token": github_token,
      },
      body: JSON.stringify({
        messages: [
          {
            id: "123456",
            content:
              'Find the file in the repository that manages feature flags, typically named with "feature_flags" or similar. For each feature flag definition, provide a structured JSON object with the file_path, line_start, line_end, and feature_flag_name. The line_start and line_end should encompass only the lines relevant to that specific feature flag, not including other flags. Feature flag definitions typically only require one line, so line_start and line_end will typically be the same line. The output must be a valid JSON array in the following format: [{"file_path": "path/to/feature_flags_file.js", "line_start": 5, "line_end": 5, "feature_flag_name": "EXAMPLE_FLAG"}, ...]. Ensure that each object in the array represents a single feature flag with its exact line range. Your response must contain an object we can load with JSON.parse(), without any additional text, formatting, or code blocks.',
            role: "user",
          },
        ],
        repositories: [
          {
            remote: "github",
            branch,
            repository: `${owner}/${repository}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`HTTP error! response: ${await response.text()}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    const featureFlagsData = JSON.parse(responseData.message);
    console.log(featureFlagsData);
    // Filter out repeated feature flag names
    const uniqueFeatureFlags = featureFlagsData.filter(
      (flag: FeatureFlag, index: number, self: FeatureFlag[]) =>
        index ===
        self.findIndex((t) => t.feature_flag_name === flag.feature_flag_name)
    );
    return uniqueFeatureFlags.map(
      ({
        file_path,
        line_start,
        line_end,
        feature_flag_name,
      }: {
        file_path: string;
        line_start: number;
        line_end: number;
        feature_flag_name: string;
      }) => ({
        file_path: file_path.substring(1),
        line_start,
        line_end,
        feature_flag_name,
      })
    );
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    throw error;
  }
};

export const fetchFeatureFlagUsage = async (
  owner: string,
  repository: string,
  branch: string,
  featureFlags: FeatureFlag[]
) => {
  try {
    const response = await fetch("https://api.greptile.com/v2/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${greptile_api_key}`,
        "X-Github-Token": github_token,
      },
      body: JSON.stringify({
        messages: [
          {
            id: "123456",
            content: `Find all occurrences of the following feature flags: ${featureFlags.map((flag) => flag.feature_flag_name).join(", ")}. For each occurrence, provide a structured JSON object with the file_path, line_start, line_end, feature_flag_name, and the surrounding code snippet. Ignore any occurrences in the files where the feature flags are defined (${featureFlags.map((flag) => flag.file_path).join(", ")}), as these are just definitions and we're interested in actual usage. The output must be a valid JSON array in the following format: [{"file_path": "path/to/file.js", "line_start": 40, "line_end": 45, "feature_flag_name": "FEATURE_FLAG_NAME", "snippet": "if (FEATURE_FLAG_NAME) { ... }"}]. Ensure that each object in the array represents a single occurrence of a feature flag. Your response must contain an object we can load with JSON.parse(), without any additional text, formatting, or code blocks.`,
            role: "user",
          },
        ],
        repositories: [
          {
            remote: "github",
            branch,
            repository: `${owner}/${repository}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`HTTP error! response: ${await response.text()}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    const featureFlagUsageData: FeatureFlagUsage[] = JSON.parse(
      responseData.message
    ).map((usage: any) => ({
      file_path: usage.file_path.substring(1),
      line_start: usage.line_start,
      line_end: usage.line_end,
      feature_flag_name: usage.feature_flag_name,
      snippet: usage.snippet,
    }));

    console.log(featureFlagUsageData);

    return featureFlagUsageData;
  } catch (error) {
    console.error("Error fetching feature flag usage:", error);
    throw error;
  }
};

export const indexRepository = async (owner: string, repository: string) => {
  try {
    const response = await fetch(
      "https://api.greptile.com/api/v2/repositories",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": `Bearer ${greptile_api_key}`,
          "X-Github-Token": github_token,
        },
        body: JSON.stringify({
          remote: "github",
          repository: `${owner}/${repository}`,
          notify: true,
        }),
      }
    );

    if (!response.ok) {
      console.error(`HTTP error! response: ${await response.text()}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log("Repository indexed successfully:", responseData);

    return responseData;
  } catch (error) {
    console.error("Error indexing repository:", error);
    throw error;
  }
};
