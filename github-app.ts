import { App, Octokit } from "octokit";
import { env } from "./env.js";
import { FileWithUpdatedContent } from "./types/file.js";

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

export async function getBlobWithMetadata(
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

  return data;
}

export async function getBlob(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string
) {
  const { content } = await getBlobWithMetadata(octokit, owner, repo, path);
  return Buffer.from(content, "base64").toString("utf-8");
}

export async function createPr(
  octokit: Octokit,
  owner: string,
  repo: string,
  changes: FileWithUpdatedContent[]
) {
  const message = "updates from green-flag";
  const baseBranch = "main";
  const branch = `green-flag/${crypto.randomUUID()}`;

  const { data: baseRef } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    {
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    }
  );

  // Create a branch
  await octokit.rest.git.createRef({
    repo,
    owner,
    ref: `refs/heads/${branch}`,
    sha: baseRef.object.sha,
  });

  for await (const { path, updatedContent } of changes) {
    const { sha } = await getBlobWithMetadata(octokit, owner, repo, path);
    // update file
    await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      repo,
      owner,
      path, // the path to file needed to be created
      sha,
      message, // a commit message
      content: Buffer.from(updatedContent).toString("base64"), // the content of your file, must be base64 encoded
      branch, // the branch name we used when creating a Git reference
    });
  }

  // create a PR from that branch with the commit of our added file
  const { data: pullRequestData } = await octokit.request(
    "POST /repos/{owner}/{repo}/pulls",
    {
      owner,
      repo,
      title: "chore: clean up stale feature flags", // the title of the PR
      head: branch, // the branch our changes are on
      base: baseBranch, // the branch to which you want to merge your changes
      body: message, // the body of your PR
      maintainer_can_modify: true, // allows maintainers to edit your app's PR
    }
  );

  return pullRequestData.html_url;
}
