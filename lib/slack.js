import logger from "@/lib/logger";

/**
 * Send a notification to Slack via Incoming Webhook.
 *
 * Message includes: repo name, event type, title, GitHub URL, actions performed.
 */
export async function sendSlackNotification({
  repoName,
  eventType,
  action,
  title,
  sender,
  url,
  actionsPerformed = [],
  aiSummary = null,
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn("SLACK_WEBHOOK_URL not configured, skipping notification");
    return { success: false, error: "Slack webhook not configured" };
  }

  // Build action summary text
  const actionText = actionsPerformed.length > 0
    ? actionsPerformed.map((a) => `• ${a}`).join("\n")
    : "• No actions taken";

  // Emoji mapping for event types
  const eventEmoji = {
    issues: "🐛",
    pull_request: "🔀",
    push: "📦",
  };

  const emoji = eventEmoji[eventType] || "📌";

  // Build Slack Block Kit message
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${eventType}${action ? `.${action}` : ""} — ${repoName}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Repository:*\n${repoName}`,
        },
        {
          type: "mrkdwn",
          text: `*Event:*\n${eventType}${action ? ` (${action})` : ""}`,
        },
        {
          type: "mrkdwn",
          text: `*Triggered by:*\n${sender || "unknown"}`,
        },
        {
          type: "mrkdwn",
          text: `*Title:*\n${title || "N/A"}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Actions Performed:*\n${actionText}`,
      },
    },
  ];

  // Add AI summary block if available
  if (aiSummary) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🤖 AI Summary:*\n${aiSummary}`,
      },
    });
  }

  // Add link button if URL is available
  if (url) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View on GitHub →",
            emoji: true,
          },
          url: url,
          style: "primary",
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `⚡ GitBot Automation • ${new Date().toISOString()}`,
      },
    ],
  });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack API error: ${response.status} ${text}`);
    }

    logger.info({ repoName, eventType }, "Slack notification sent");
    return { success: true };
  } catch (error) {
    logger.error({ error: error.message, repoName, eventType }, "Failed to send Slack notification");
    return { success: false, error: error.message };
  }
}
