import express from "express";
import { githubApp } from "./github-app.js";
import { Octokit } from 'octokit';
import { env } from "./env.js";
import { ClaudeSonnetClient } from "./anthropic-client.js";

const app = express();

app.post('/check/:owner/:repo', async function (req, res) {
  try {
    const { owner, repo } = req.params;
    const { data: { id } } = await githubApp.octokit.request('GET /repos/{owner}/{repo}/installation', {
      owner,
      repo,
    })
    console.log(`repo ${owner}/${repo} has installation id ${id}`);
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