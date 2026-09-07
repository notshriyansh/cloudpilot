import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(env.cloudpilot, env.TEST_MIGRATIONS);
