import express from "express";
import { getOctokit, githubApp } from "./github-app.js";
import { Octokit } from 'octokit';
import { env } from "./env.js";
import { ClaudeSonnetClient } from "./anthropic-client.js";

const app = express();

app.post('/check/:owner/:repo', async function (req, res) {
  try {
    const { owner, repo } = req.params;
    const octokit = await getOctokit(owner, repo);
  } catch (e) {
    console.error(e);
    return res.status(500).send();
  }
  return res.status(200).send();
});

app.listen(3000);

// Create Octokit client
const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
const anthropicClient = new ClaudeSonnetClient();