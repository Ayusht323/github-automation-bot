import { pgTable, serial, text, integer, boolean, timestamp, uuid, varchar, index, unique } from "drizzle-orm/pg-core";

// ── Users ──────────────────────────────────────────────────────────────
// Core user record from GitHub OAuth.
// Access tokens are managed by Auth.js's built-in accounts table.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubId: integer("github_id").unique().notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Auth.js required tables ────────────────────────────────────────────
// These tables are required by the Drizzle adapter for Auth.js
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: varchar("token_type", { length: 255 }),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

// ── Repositories ───────────────────────────────────────────────────────
// Tracks connected GitHub repositories with their webhook state.
export const repositories = pgTable("repositories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  githubRepoId: integer("github_repo_id").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  webhookId: integer("webhook_id"),
  webhookActive: boolean("webhook_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("uq_user_repo").on(table.userId, table.githubRepoId),
]);

// ── Events ─────────────────────────────────────────────────────────────
// Stores received webhook events with only the essential fields.
// Full payloads are NOT stored (per design decision).
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  repositoryId: integer("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  deliveryId: varchar("delivery_id", { length: 255 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }),
  title: text("title"),
  sender: varchar("sender", { length: 255 }),
  issueNumber: integer("issue_number"),
  branch: varchar("branch", { length: 255 }),
  url: text("url"),
  aiSummary: text("ai_summary"),
  aiLabels: text("ai_labels"),        // Stored as JSON string for simplicity
  status: varchar("status", { length: 20 }).default("received").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("uq_delivery").on(table.repositoryId, table.deliveryId),
  index("idx_events_repo").on(table.repositoryId, table.createdAt),
  index("idx_events_status").on(table.status),
]);

// ── Actions ────────────────────────────────────────────────────────────
// Records each action the bot takes in response to an event.
export const actions = pgTable("actions", {
  id: serial("id").primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }),
  comment: text("comment"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_actions_event").on(table.eventId),
]);

// ── Rules ──────────────────────────────────────────────────────────────
// Simple rule definitions: event_type + keyword → action + label.
// Case-insensitive keyword matching is handled at query time.
export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: integer("repository_id").references(() => repositories.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  keyword: varchar("keyword", { length: 255 }),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }),
  commentTemplate: text("comment_template"),
  slackNotify: boolean("slack_notify").default(true),
  aiTriage: boolean("ai_triage").default(false),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_rules_user").on(table.userId, table.enabled),
]);
