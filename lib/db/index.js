import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Initialize neon connection. If DATABASE_URL is missing (e.g., during build time),
// provide a dummy query function that throws at runtime, so drizzle() can still
// initialize a valid Postgres instance for the Auth.js DrizzleAdapter.
const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : () => { throw new Error("DATABASE_URL environment variable is not set"); };

export const db = drizzle(sql, { schema });

