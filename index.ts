import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import { env } from "./env.js";
import { App } from "octokit";
import { createServer } from "node:http";
import SmeeClient from "smee-client";

const app = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY,
});

const webhooks = new Webhooks({
  secret: env.WEBHOOK_SECRET,
});

webhooks.on("pull_request", ({ id, payload }) => {
  console.log(`Received pull request event (ID: ${id}):`, payload.action);
});


const middleware = createNodeMiddleware(webhooks, { path: "/webhooks" });

createServer(async (req, res) => {
  // `middleware` returns `false` when `req` is unhandled (beyond `/webhooks`)
  if (await middleware(req, res)) return;
  res.writeHead(404);
  res.end();
}).listen(3000);

new SmeeClient({
  source: env.SMEE_URL,
  target: 'http://localhost:3000/webhooks',
}).start();
