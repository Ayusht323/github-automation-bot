import { db } from "@/lib/db";
import { rules, repositories } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import logger from "@/lib/logger";

/**
 * GET /api/rules
 * List all rules for the authenticated user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userRules = await db
      .select()
      .from(rules)
      .where(eq(rules.userId, session.user.dbId))
      .orderBy(rules.createdAt);

    // Fetch repo names for rules
    const repoIds = [...new Set(userRules.filter((r) => r.repositoryId).map((r) => r.repositoryId))];
    const repoMap = {};
    
    if (repoIds.length > 0) {
      const repos = await db
        .select({ id: repositories.id, fullName: repositories.fullName })
        .from(repositories);
      repos.forEach((r) => { repoMap[r.id] = r.fullName; });
    }

    const enriched = userRules.map((rule) => ({
      ...rule,
      repoFullName: rule.repositoryId ? repoMap[rule.repositoryId] || "Unknown" : "All repositories",
    }));

    return Response.json({ rules: enriched });
  } catch (error) {
    logger.error({ error: error.message }, "Failed to fetch rules");
    return Response.json({ error: "Failed to fetch rules" }, { status: 500 });
  }
}

/**
 * POST /api/rules
 * Create a new rule.
 */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, eventType, keyword, actionType, label, commentTemplate, slackNotify, aiTriage, repositoryId } = body;

  if (!name || !eventType || !actionType) {
    return Response.json({ error: "name, eventType, and actionType are required" }, { status: 400 });
  }

  // Validate actionType
  const validActions = ["add_label", "post_comment", "add_label_and_comment"];
  if (!validActions.includes(actionType)) {
    return Response.json({ error: "Invalid actionType" }, { status: 400 });
  }

  // If action includes label, label must be provided
  if ((actionType === "add_label" || actionType === "add_label_and_comment") && !label) {
    return Response.json({ error: "Label is required for this action type" }, { status: 400 });
  }

  // If repositoryId is provided, verify ownership
  if (repositoryId) {
    const [repo] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.id, repositoryId),
          eq(repositories.userId, session.user.dbId)
        )
      )
      .limit(1);

    if (!repo) {
      return Response.json({ error: "Repository not found" }, { status: 404 });
    }
  }

  try {
    const [newRule] = await db
      .insert(rules)
      .values({
        userId: session.user.dbId,
        repositoryId: repositoryId || null,
        name,
        eventType,
        keyword: keyword || null,
        actionType,
        label: label || null,
        commentTemplate: commentTemplate || null,
        slackNotify: slackNotify !== false,
        aiTriage: aiTriage || false,
      })
      .returning();

    logger.info({ ruleId: newRule.id, name }, "Rule created");
    return Response.json({ rule: newRule }, { status: 201 });
  } catch (error) {
    logger.error({ error: error.message }, "Failed to create rule");
    return Response.json({ error: "Failed to create rule" }, { status: 500 });
  }
}
