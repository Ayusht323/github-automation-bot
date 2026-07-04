import { db } from "@/lib/db";
import { repositories } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { listUserRepos, createWebhook, deleteWebhook } from "@/lib/github";
import logger from "@/lib/logger";

/**
 * GET /api/repos
 * List connected repositories + available GitHub repos for the user.
 */
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeGithub = searchParams.get("include_github") === "true";

  try {
    // Get connected repos from our DB
    const connected = await db
      .select()
      .from(repositories)
      .where(eq(repositories.userId, session.user.dbId))
      .orderBy(repositories.createdAt);

    let githubRepos = [];
    if (includeGithub) {
      try {
        githubRepos = await listUserRepos(session.user.dbId);
      } catch (error) {
        logger.error({ error: error.message }, "Failed to fetch GitHub repos");
      }
    }

    return Response.json({
      connected,
      available: githubRepos,
    });
  } catch (error) {
    logger.error({ error: error.message }, "Failed to fetch repos");
    return Response.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}

/**
 * POST /api/repos
 * Connect a repository — creates a webhook on GitHub.
 * Body: { githubRepoId: number, fullName: "owner/repo" }
 */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { githubRepoId, fullName } = await request.json();

  if (!githubRepoId || !fullName) {
    return Response.json({ error: "githubRepoId and fullName are required" }, { status: 400 });
  }

  // Check if already connected
  const existing = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.userId, session.user.dbId),
        eq(repositories.githubRepoId, githubRepoId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return Response.json({ error: "Repository already connected" }, { status: 409 });
  }

  const [owner, repoName] = fullName.split("/");

  try {
    // Create webhook on GitHub
    const appUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.VERCEL_URL;
    const webhookUrl = `${appUrl?.startsWith("http") ? appUrl : `https://${appUrl}`}/api/webhooks/github`;

    const { webhookId } = await createWebhook(
      session.user.dbId,
      owner,
      repoName,
      webhookUrl,
      process.env.GITHUB_WEBHOOK_SECRET
    );

    // Store in our DB
    const [repo] = await db
      .insert(repositories)
      .values({
        userId: session.user.dbId,
        githubRepoId,
        fullName,
        webhookId,
        webhookActive: true,
      })
      .returning();

    logger.info({ repoId: repo.id, fullName }, "Repository connected");
    return Response.json({ repo }, { status: 201 });
  } catch (error) {
    logger.error({ error: error.message, fullName }, "Failed to connect repository");
    return Response.json({ error: `Failed to connect: ${error.message}` }, { status: 500 });
  }
}
