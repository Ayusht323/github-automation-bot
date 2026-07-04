import { db } from "@/lib/db";
import { events, actions, repositories } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, sql, and, inArray } from "drizzle-orm";
import logger from "@/lib/logger";

/**
 * GET /api/events/stats
 * Returns dashboard statistics for the authenticated user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user's repository IDs
    const userRepos = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.userId, session.user.dbId));

    const repoIds = userRepos.map((r) => r.id);

    if (repoIds.length === 0) {
      return Response.json({
        totalEvents: 0,
        successfulActions: 0,
        failedActions: 0,
        activeRules: 0,
        connectedRepos: 0,
      });
    }

    // Total events
    const [{ totalEvents }] = await db
      .select({ totalEvents: sql`count(*)::int` })
      .from(events)
      .where(inArray(events.repositoryId, repoIds));

    // Get all event IDs for action stats
    const userEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(inArray(events.repositoryId, repoIds));

    const eventIds = userEvents.map((e) => e.id);

    let successfulActions = 0;
    let failedActions = 0;

    if (eventIds.length > 0) {
      const [successResult] = await db
        .select({ count: sql`count(*)::int` })
        .from(actions)
        .where(and(inArray(actions.eventId, eventIds), eq(actions.status, "success")));
      successfulActions = successResult.count;

      const [failedResult] = await db
        .select({ count: sql`count(*)::int` })
        .from(actions)
        .where(and(inArray(actions.eventId, eventIds), eq(actions.status, "failed")));
      failedActions = failedResult.count;
    }

    // Active rules count
    const { rules: rulesTable } = await import("@/lib/db/schema");
    const [{ activeRules }] = await db
      .select({ activeRules: sql`count(*)::int` })
      .from(rulesTable)
      .where(and(eq(rulesTable.userId, session.user.dbId), eq(rulesTable.enabled, true)));

    return Response.json({
      totalEvents,
      successfulActions,
      failedActions,
      activeRules,
      connectedRepos: repoIds.length,
    });
  } catch (error) {
    logger.error({ error: error.message }, "Failed to fetch stats");
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
