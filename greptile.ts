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
            content:
              'Provide a structured JSON output with the filepath, linestart, and lineend of all areas that use feature flags. Provide only the JSON and nothing else. The output should be in the following format: [{"filepath": "path/to/file", "linestart": 10, "lineend": 15}, ...]',
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
    const featureFlagsData = JSON.parse(
      responseData.message.match(/```json\n([\s\S]*?)\n```/)[1]
    );
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
        file_path: filepath.substring(1),
        line_start: linestart,
        line_end: lineend,
      })
    );
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    throw error;
  }
};
