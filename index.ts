import express from "express";
import { createPr, getOctokit } from "./github-app.js";
import { ClaudeSonnetClient } from "./anthropic-client.js";
import { fetchRelevantCode, indexRepository } from "./greptile.js";
import { analyzeFeatureFlags, analyzeWithLintRule } from "./analyze.js";
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
app.use(express.json());

app.post("/check/:owner/:repo", async function (req, res) {
  try {
    const { owner, repo } = req.params;
    console.log(`Checking ${owner}/${repo}`);
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
    return res.status(200).json({ prUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).send();
  }
});

app.post("/lint/:owner/:repo", async function (req, res) {
  try {
    const { owner, repo } = req.params;
    const { query } = req.body;
    const octokit = await getOctokit(owner, repo);
    const anthropicClient = new ClaudeSonnetClient();

    const rule = await anthropicClient.getStructuredLintRule(query);

    console.log(
      `Analyzing ${owner}/${repo} with rule: ${JSON.stringify(rule, null, 2)}`
    );

    const fileWithRanges = await analyzeWithLintRule(
      octokit,
      owner,
      repo,
      "main",
      rule
    );

    const changedFiles = await anthropicClient.invokeModelWithLintRule(
      fileWithRanges,
      rule
    );
    const prUrl = await createPr(octokit, owner, repo, changedFiles);
    console.log(`Created PR: ${prUrl}`);
  } catch (e) {
    console.error(e);
    return res.status(500).send();
  }
});

app.use(createNodeMiddleware(webhooks, { path: "/webhook" }));

app.listen(3000);

new SmeeClient({
  source: env.SMEE_URL,
  target: "http://localhost:3000/webhook",
}).start();
