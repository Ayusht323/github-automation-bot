import { db } from "@/lib/db";
import { actions, events, repositories } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, inArray } from "drizzle-orm";
import { addLabel, postComment } from "@/lib/github";
import { sendSlackNotification } from "@/lib/slack";
import logger from "@/lib/logger";

/**
 * POST /api/events/retry
 * Retry a failed action.
 * Body: { actionId: number }
 */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { actionId } = await request.json();

  if (!actionId) {
    return Response.json({ error: "actionId is required" }, { status: 400 });
  }

  try {
    // Fetch the action and verify ownership
    const [action] = await db
      .select()
      .from(actions)
      .where(eq(actions.id, actionId))
      .limit(1);

    if (!action) {
      return Response.json({ error: "Action not found" }, { status: 404 });
    }

    // Get the event and repo to verify ownership
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, action.eventId))
      .limit(1);

    if (!event) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    const [repo] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.id, event.repositoryId),
          eq(repositories.userId, session.user.dbId)
        )
      )
      .limit(1);

    if (!repo) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update retry count
    await db
      .update(actions)
      .set({
        status: "pending",
        retryCount: (action.retryCount || 0) + 1,
        errorMessage: null,
      })
      .where(eq(actions.id, actionId));

    const [owner, repoName] = repo.fullName.split("/");

    // Retry the action
    try {
      switch (action.actionType) {
        case "label_added":
          if (action.label && event.issueNumber) {
            await addLabel(session.user.dbId, owner, repoName, event.issueNumber, action.label);
          }
          break;
        case "comment_posted":
          if (action.comment && event.issueNumber) {
            await postComment(session.user.dbId, owner, repoName, event.issueNumber, action.comment);
          }
          break;
        case "slack_sent":
          await sendSlackNotification({
            repoName: repo.fullName,
            eventType: event.eventType,
            action: event.action,
            title: event.title,
            sender: event.sender,
            url: event.url,
            actionsPerformed: ["Retry"],
          });
          break;
      }

      await db
        .update(actions)
        .set({ status: "success" })
        .where(eq(actions.id, actionId));

      logger.info({ actionId, actionType: action.actionType }, "Action retried successfully");
      return Response.json({ message: "Retry successful" });
    } catch (error) {
      await db
        .update(actions)
        .set({ status: "failed", errorMessage: error.message })
        .where(eq(actions.id, actionId));

      logger.error({ error: error.message, actionId }, "Retry failed");
      return Response.json({ error: "Retry failed", details: error.message }, { status: 500 });
    }
  } catch (error) {
    logger.error({ error: error.message }, "Retry handler error");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
