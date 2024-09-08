import { App, Octokit } from "octokit";
import { env } from "./env.js";

export const githubApp = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY,
});

export async function getOctokit(owner: string, repo: string) {
  const {
    data: { id },
  } = await githubApp.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    {
      owner,
      repo,
    }
  );
  return await githubApp.getInstallationOctokit(id);
}

export async function getBlob(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string
) {
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/contents/{path}",
    {
      owner,
      repo,
      path,
    }
  );

  if (Array.isArray(data)) {
    throw new Error("Path is a directory");
  }
  if (data.type !== "file") {
    throw new Error("Path is not a file");
  }

  return Buffer.from(data.content, "base64").toString("utf-8");
}
