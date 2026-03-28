import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// .env.local für drizzle-kit laden (wird von Next.js automatisch geladen, nicht aber von drizzle-kit)
dotenv.config({ path: ".env.local" });

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
