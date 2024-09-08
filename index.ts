import express from "express";
import { createPr, getOctokit } from "./github-app.js";
import { ClaudeSonnetClient } from "./anthropic-client.js";
import { indexRepository } from "./greptile.js";
import { analyzeFeatureFlags } from "./analyze.js";
import { createNodeMiddleware, Webhooks } from "@octokit/webhooks";
import { env } from "./env.js";
import SmeeClient from "smee-client";

const webhooks = new Webhooks({
  secret: env.WEBHOOK_SECRET,
});

webhooks.on("push", async (event) => {
  try {
    if (event.payload.ref !== "refs/heads/main") return;
    const name = event.payload.repository.name;
    const owner = event.payload.repository.owner?.login;

    if (!owner) {
      console.error("No owner found");
      return;
    }
    console.log(`Reindexing ${owner}/${name}`);
    await indexRepository(owner, name);
  } catch (e) {
    console.error(e);
  }
});

const app = express();

app.get("/check/:owner/:repo", async function (req, res) {
  try {
    const { owner, repo } = req.params;
    const octokit = await getOctokit(owner, repo);
    const anthropicClient = new ClaudeSonnetClient();

    const analysis = await analyzeFeatureFlags(
      octokit,
      anthropicClient,
      repo,
      "main",
      owner
    );
    const changedFiles = await anthropicClient.invokeModelWithCode(analysis);
    const prUrl = await createPr(octokit, owner, repo, changedFiles);
    console.log(`Created PR: ${prUrl}`);
  } catch (e) {
    console.error(e);
    return res.status(500).send();
  }
  return res.status(200).send();
});

app.use(createNodeMiddleware(webhooks, { path: "/webhook" }));

app.listen(3000);

new SmeeClient({
  source: env.SMEE_URL,
  target: "http://localhost:3000/webhook",
}).start();
