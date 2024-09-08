import { cleanEnv, str } from "envalid";

export const env = cleanEnv(process.env, {
  WEBHOOK_SECRET: str(),
  GITHUB_APP_ID: str(),
  GITHUB_PRIVATE_KEY: str(),
  SMEE_URL: str(),
});
