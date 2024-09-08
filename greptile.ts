import { env } from "./env.js";

export interface FeatureFlag {
  file_path: string;
  line_start: number;
  line_end: number;
  change_date: Date | null;
}

// HACK: This function assumes the repository has been indexed by Greptile
export const fetchFeatureFlags = async (
    owner: string,
  repository: string,
  branch: string
): Promise<FeatureFlag[]> => {
  const greptile_api_key = env.GREPTILE_API_KEY;
  const github_token = env.GITHUB_TOKEN;

  if (!greptile_api_key || !github_token) {
    throw new Error("Missing required environment variables");
  }

  try {
    const response = await fetch("https://api.greptile.com/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${greptile_api_key}`,
        "X-Github-Token": github_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "Give me all of the files and lines that contain feature flags",
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

    const featureFlagsData = await response.json();
    return featureFlagsData.map(
      ({
        filepath,
        linestart,
        lineend,
      }: {
        filepath: string;
        linestart: number;
        lineend: number;
      }) => ({
        file_path: filepath,
        line_start: linestart,
        line_end: lineend,
      })
    );
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    throw error;
  }
};
