import { env } from "./env.js";
import { App } from "octokit";
import express from "express";

const githubApp = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY,
});

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
})

app.listen(3000);
