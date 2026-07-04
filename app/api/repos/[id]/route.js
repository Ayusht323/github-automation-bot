import { db } from "@/lib/db";
import { repositories } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { deleteWebhook } from "@/lib/github";
import logger from "@/lib/logger";

/**
 * DELETE /api/repos/[id]
 * Disconnect a repository — removes the webhook from GitHub.
 */
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const [repo] = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.id, parseInt(id)),
        eq(repositories.userId, session.user.dbId)
      )
    )
    .limit(1);

  if (!repo) {
    return Response.json({ error: "Repository not found" }, { status: 404 });
  }

  const [owner, repoName] = repo.fullName.split("/");

  try {
    // Delete webhook from GitHub
    if (repo.webhookId) {
      try {
        await deleteWebhook(session.user.dbId, owner, repoName, repo.webhookId);
      } catch (error) {
        // If webhook was already deleted on GitHub's side, continue
        logger.warn({ error: error.message, webhookId: repo.webhookId }, "Could not delete webhook (may already be removed)");
      }
    }

    // Remove from our DB
    await db
      .delete(repositories)
      .where(eq(repositories.id, parseInt(id)));

    logger.info({ repoId: id, fullName: repo.fullName }, "Repository disconnected");
    return Response.json({ message: "Repository disconnected" });
  } catch (error) {
    logger.error({ error: error.message, repoId: id }, "Failed to disconnect repository");
    return Response.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
