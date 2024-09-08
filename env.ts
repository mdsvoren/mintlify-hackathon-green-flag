import { cleanEnv, str } from "envalid";
import dotenv from "dotenv";

dotenv.config();

export const env = cleanEnv(process.env, {
  WEBHOOK_SECRET: str(),
  GITHUB_APP_ID: str(),
  GITHUB_PRIVATE_KEY: str(),
  SMEE_URL: str(),
  GREPTILE_API_KEY: str(),
  GITHUB_TOKEN: str(),
  ANTHROPIC_API_KEY: str(),
});
