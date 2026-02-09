import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts", // ✅ Schema CNI limpio
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL! + (process.env.DATABASE_URL!.includes('?') ? '&' : '?') + 'sslmode=require',
  },
  verbose: true,
  strict: true,
});
