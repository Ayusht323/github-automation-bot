import { db } from "@/lib/db";
import { rules } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import logger from "@/lib/logger";

/**
 * Find all matching rules for a given event.
 * Matching logic:
 *   1. Rule event_type must match the event's event_type
 *   2. If rule has a keyword, it must appear in the event title (case-insensitive)
 *   3. Rule must be enabled
 *   4. Rule must belong to the event's repository owner (by userId)
 *   5. Rule must apply to the specific repo OR to all repos (repositoryId IS NULL)
 */
export async function findMatchingRules(userId, repositoryId, eventType, title) {
  try {
    // Fetch all enabled rules for this user + event type
    const userRules = await db
      .select()
      .from(rules)
      .where(
        and(
          eq(rules.userId, userId),
          eq(rules.eventType, eventType),
          eq(rules.enabled, true),
          or(
            eq(rules.repositoryId, repositoryId),
            isNull(rules.repositoryId)
          )
        )
      );

    // Filter by keyword (case-insensitive)
    const matched = userRules.filter((rule) => {
      if (!rule.keyword) return true; // No keyword = match all
      if (!title) return false;       // Has keyword but no title to match
      return title.toLowerCase().includes(rule.keyword.toLowerCase());
    });

    logger.info(
      { userId, repositoryId, eventType, matchedCount: matched.length, totalRules: userRules.length },
      "Rule matching completed"
    );

    return matched;
  } catch (error) {
    logger.error({ error: error.message, userId, eventType }, "Rule matching failed");
    return [];
  }
}

/**
 * Interpolate template variables in comment templates.
 * Supported variables: {title}, {sender}, {repo}, {event_type}, {action}
 */
export function interpolateTemplate(template, variables) {
  if (!template) return null;

  return template
    .replace(/\{title\}/g, variables.title || "N/A")
    .replace(/\{sender\}/g, variables.sender || "unknown")
    .replace(/\{repo\}/g, variables.repo || "N/A")
    .replace(/\{event_type\}/g, variables.eventType || "N/A")
    .replace(/\{action\}/g, variables.action || "N/A");
}
