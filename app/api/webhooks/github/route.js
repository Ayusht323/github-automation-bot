import crypto from "crypto";
import { db } from "@/lib/db";
import { events, actions, repositories, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { findMatchingRules, interpolateTemplate } from "@/lib/ruleEngine";
import { addLabel, postComment } from "@/lib/github";
import { sendSlackNotification } from "@/lib/slack";
import { analyzeWithAI } from "@/lib/ai";
import logger from "@/lib/logger";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

/**
 * POST /api/webhooks/github
 *
 * Receives GitHub webhook events. Pipeline:
 * 1. Rate limit check
 * 2. Verify HMAC-SHA256 signature (reject forged requests)
 * 3. Check idempotency (reject duplicate deliveries)
 * 4. Store event with status: received
 * 5. Match rules and execute actions
 * 6. Update event status to completed/failed
 */
export async function POST(request) {
  const startTime = Date.now();

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.resetAt);
  }

  // ── Step 1: Read raw body for signature verification ──
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const deliveryId = request.headers.get("x-github-delivery");
  const eventType = request.headers.get("x-github-event");

  if (!signature || !deliveryId || !eventType) {
    logger.warn({ ip }, "Missing required GitHub webhook headers");
    return Response.json({ error: "Missing webhook headers" }, { status: 400 });
  }

  // ── Step 2: Verify HMAC-SHA256 signature ──
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("GITHUB_WEBHOOK_SECRET not configured");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const expectedSignature = "sha256=" + crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    logger.warn({ ip, deliveryId }, "Invalid webhook signature — possible forgery");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Step 3: Parse payload and extract key fields ──
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Skip ping events
  if (eventType === "ping") {
    logger.info({ deliveryId }, "Received ping event");
    return Response.json({ message: "pong" });
  }

  // Extract key fields based on event type
  const repoFullName = payload.repository?.full_name;
  const repoGithubId = payload.repository?.id;

  if (!repoFullName || !repoGithubId) {
    return Response.json({ error: "Missing repository info" }, { status: 400 });
  }

  // Find the repository in our DB
  const [repo] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.githubRepoId, repoGithubId))
    .limit(1);

  if (!repo) {
    logger.warn({ repoFullName, deliveryId }, "Webhook for unregistered repository");
    return Response.json({ error: "Repository not registered" }, { status: 404 });
  }

  // Extract event-specific fields
  let title, sender, issueNumber, branch, url, body;
  const eventAction = payload.action || null;

  switch (eventType) {
    case "issues":
      title = payload.issue?.title;
      sender = payload.sender?.login;
      issueNumber = payload.issue?.number;
      url = payload.issue?.html_url;
      body = payload.issue?.body;
      break;
    case "pull_request":
      title = payload.pull_request?.title;
      sender = payload.sender?.login;
      issueNumber = payload.pull_request?.number;
      url = payload.pull_request?.html_url;
      body = payload.pull_request?.body;
      break;
    case "push":
      title = payload.head_commit?.message || `Push to ${payload.ref}`;
      sender = payload.sender?.login;
      branch = payload.ref?.replace("refs/heads/", "");
      url = payload.compare;
      break;
    default:
      logger.info({ eventType, deliveryId }, "Unhandled event type");
      return Response.json({ message: "Event type not handled" });
  }

  // ── Step 4: Idempotency check + store event ──
  let event;
  try {
    [event] = await db
      .insert(events)
      .values({
        repositoryId: repo.id,
        deliveryId,
        eventType,
        action: eventAction,
        title,
        sender,
        issueNumber,
        branch,
        url,
        status: "received",
      })
      .onConflictDoNothing({ target: [events.repositoryId, events.deliveryId] })
      .returning();

    if (!event) {
      logger.info({ deliveryId, repoFullName }, "Duplicate delivery — already processed");
      return Response.json({ message: "Already processed" }, { status: 200 });
    }
  } catch (error) {
    logger.error({ error: error.message, deliveryId }, "Failed to store event");
    return Response.json({ error: "Failed to store event" }, { status: 500 });
  }

  // ── Step 5: Process event — match rules and execute actions ──
  try {
    await db
      .update(events)
      .set({ status: "processing" })
      .where(eq(events.id, event.id));

    // Find matching rules
    const matchedRules = await findMatchingRules(repo.userId, repo.id, eventType, title);

    if (matchedRules.length === 0) {
      await db
        .update(events)
        .set({ status: "completed", processedAt: new Date() })
        .where(eq(events.id, event.id));

      logger.info({ deliveryId, eventType, repoFullName }, "No matching rules");
      return Response.json({ message: "Processed — no matching rules", eventId: event.id });
    }

    const [owner, repoName] = repoFullName.split("/");
    const actionsPerformed = [];
    let aiResult = null;

    // Execute each matching rule
    for (const rule of matchedRules) {
      try {
        // AI triage if enabled on this rule
        if (rule.aiTriage && !aiResult && (eventType === "issues" || eventType === "pull_request")) {
          aiResult = await analyzeWithAI(title, body, eventType);
          if (aiResult) {
            await db
              .update(events)
              .set({
                aiSummary: aiResult.summary,
                aiLabels: JSON.stringify(aiResult.labels),
              })
              .where(eq(events.id, event.id));
          }
        }

        // Execute actions based on rule type
        if (rule.actionType === "add_label" || rule.actionType === "add_label_and_comment") {
          if (rule.label && issueNumber) {
            try {
              await addLabel(repo.userId, owner, repoName, issueNumber, rule.label);
              await db.insert(actions).values({
                eventId: event.id,
                actionType: "label_added",
                label: rule.label,
                status: "success",
              });
              actionsPerformed.push(`Added label: ${rule.label}`);
            } catch (err) {
              await db.insert(actions).values({
                eventId: event.id,
                actionType: "label_added",
                label: rule.label,
                status: "failed",
                errorMessage: err.message,
              });
              actionsPerformed.push(`Failed to add label: ${rule.label}`);
            }
          }
        }

        if (rule.actionType === "post_comment" || rule.actionType === "add_label_and_comment") {
          if (rule.commentTemplate && issueNumber) {
            const commentBody = interpolateTemplate(rule.commentTemplate, {
              title,
              sender,
              repo: repoFullName,
              eventType,
              action: eventAction,
            });
            try {
              await postComment(repo.userId, owner, repoName, issueNumber, commentBody);
              await db.insert(actions).values({
                eventId: event.id,
                actionType: "comment_posted",
                comment: commentBody,
                status: "success",
              });
              actionsPerformed.push("Posted comment");
            } catch (err) {
              await db.insert(actions).values({
                eventId: event.id,
                actionType: "comment_posted",
                comment: commentBody,
                status: "failed",
                errorMessage: err.message,
              });
              actionsPerformed.push("Failed to post comment");
            }
          }
        }

        // Slack notification
        if (rule.slackNotify) {
          try {
            await sendSlackNotification({
              repoName: repoFullName,
              eventType,
              action: eventAction,
              title,
              sender,
              url,
              actionsPerformed,
              aiSummary: aiResult?.summary,
            });
            await db.insert(actions).values({
              eventId: event.id,
              actionType: "slack_sent",
              status: "success",
            });
            actionsPerformed.push("Sent Slack notification");
          } catch (err) {
            await db.insert(actions).values({
              eventId: event.id,
              actionType: "slack_sent",
              status: "failed",
              errorMessage: err.message,
            });
          }
        }
      } catch (ruleError) {
        logger.error({ error: ruleError.message, ruleId: rule.id }, "Rule execution error");
      }
    }

    // Update event status
    await db
      .update(events)
      .set({ status: "completed", processedAt: new Date() })
      .where(eq(events.id, event.id));

    const duration = Date.now() - startTime;
    logger.info(
      { deliveryId, eventType, repoFullName, rulesMatched: matchedRules.length, duration },
      "Event processed successfully"
    );

    return Response.json({
      message: "Processed",
      eventId: event.id,
      rulesMatched: matchedRules.length,
      actionsPerformed,
    });
  } catch (error) {
    // Mark event as failed
    await db
      .update(events)
      .set({ status: "failed", processedAt: new Date() })
      .where(eq(events.id, event.id));

    logger.error({ error: error.message, deliveryId }, "Event processing failed");
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
