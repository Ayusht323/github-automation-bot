import { db } from "@/lib/db";
import { events, actions, repositories } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import logger from "@/lib/logger";

/**
 * GET /api/events
 * Fetch event log for the authenticated user.
 * Query params: ?repo=id&status=received&type=issues&page=1&limit=50
 */
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repo");
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = (page - 1) * limit;

  try {
    // Get user's repository IDs
    const userRepos = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.userId, session.user.dbId));

    const repoIds = userRepos.map((r) => r.id);

    if (repoIds.length === 0) {
      return Response.json({ events: [], total: 0, page, limit });
    }

    // Build conditions
    const conditions = [inArray(events.repositoryId, repoIds)];
    if (repoId) conditions.push(eq(events.repositoryId, parseInt(repoId)));
    if (status) conditions.push(eq(events.status, status));
    if (type) conditions.push(eq(events.eventType, type));

    // Fetch events with their actions
    const eventRows = await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.createdAt))
      .limit(limit)
      .offset(offset);

    // Count total
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(events)
      .where(and(...conditions));

    // Fetch actions for these events
    const eventIds = eventRows.map((e) => e.id);
    let eventActions = [];
    if (eventIds.length > 0) {
      eventActions = await db
        .select()
        .from(actions)
        .where(inArray(actions.eventId, eventIds));
    }

    // Fetch repo full names
    const repoMap = {};
    if (repoIds.length > 0) {
      const repos = await db
        .select({ id: repositories.id, fullName: repositories.fullName })
        .from(repositories)
        .where(inArray(repositories.id, repoIds));
      repos.forEach((r) => { repoMap[r.id] = r.fullName; });
    }

    // Merge actions into events
    const enrichedEvents = eventRows.map((event) => ({
      ...event,
      repoFullName: repoMap[event.repositoryId] || "Unknown",
      actions: eventActions.filter((a) => a.eventId === event.id),
    }));

    return Response.json({
      events: enrichedEvents,
      total: count,
      page,
      limit,
    });
  } catch (error) {
    logger.error({ error: error.message }, "Failed to fetch events");
    return Response.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
