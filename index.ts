import { env } from "./env.js";
import { App } from "octokit";
import express from "express";

const app = express();

app.get('/', function (req, res) {
  res.send('Hello World')
})

app.listen(3000);

const githubApp = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY,
});
