import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import { env } from "./env.js";
import { App } from "octokit";

const app = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY,
});
