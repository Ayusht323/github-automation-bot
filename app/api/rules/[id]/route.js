import { db } from "@/lib/db";
import { rules } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import logger from "@/lib/logger";

/**
 * PATCH /api/rules/[id]
 * Update a rule (toggle enabled, edit fields).
 */
export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Verify ownership
  const [rule] = await db
    .select()
    .from(rules)
    .where(
      and(
        eq(rules.id, parseInt(id)),
        eq(rules.userId, session.user.dbId)
      )
    )
    .limit(1);

  if (!rule) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  try {
    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.eventType !== undefined) updateData.eventType = body.eventType;
    if (body.keyword !== undefined) updateData.keyword = body.keyword || null;
    if (body.actionType !== undefined) updateData.actionType = body.actionType;
    if (body.label !== undefined) updateData.label = body.label || null;
    if (body.commentTemplate !== undefined) updateData.commentTemplate = body.commentTemplate || null;
    if (body.slackNotify !== undefined) updateData.slackNotify = body.slackNotify;
    if (body.aiTriage !== undefined) updateData.aiTriage = body.aiTriage;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.repositoryId !== undefined) updateData.repositoryId = body.repositoryId || null;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(rules)
      .set(updateData)
      .where(eq(rules.id, parseInt(id)))
      .returning();

    logger.info({ ruleId: id }, "Rule updated");
    return Response.json({ rule: updated });
  } catch (error) {
    logger.error({ error: error.message, ruleId: id }, "Failed to update rule");
    return Response.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

/**
 * DELETE /api/rules/[id]
 * Delete a rule.
 */
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const [rule] = await db
    .select()
    .from(rules)
    .where(
      and(
        eq(rules.id, parseInt(id)),
        eq(rules.userId, session.user.dbId)
      )
    )
    .limit(1);

  if (!rule) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  try {
    await db
      .delete(rules)
      .where(eq(rules.id, parseInt(id)));

    logger.info({ ruleId: id }, "Rule deleted");
    return Response.json({ message: "Rule deleted" });
  } catch (error) {
    logger.error({ error: error.message, ruleId: id }, "Failed to delete rule");
    return Response.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
