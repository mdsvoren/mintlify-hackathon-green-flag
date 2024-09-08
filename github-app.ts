import { App } from "octokit";
import { env } from "./env.js";

export const githubApp = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY,
});
