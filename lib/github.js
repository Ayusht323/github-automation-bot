import { Octokit } from "@octokit/rest";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";

/**
 * Get an authenticated Octokit instance for a user.
 * Retrieves the GitHub access token from the Auth.js accounts table.
 */
export async function getOctokit(userId) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (!account?.accessToken) {
    throw new Error(`No GitHub access token found for user ${userId}`);
  }

  return new Octokit({ auth: account.accessToken });
}

/**
 * Add a label to a GitHub issue or pull request.
 * Creates the label first if it doesn't exist.
 */
export async function addLabel(userId, owner, repo, issueNumber, labelName) {
  const octokit = await getOctokit(userId);

  try {
    // Ensure the label exists (create if it doesn't)
    try {
      await octokit.rest.issues.getLabel({ owner, repo, name: labelName });
    } catch (e) {
      if (e.status === 404) {
        const colors = {
          bug: "d73a4a",
          enhancement: "a2eeef",
          documentation: "0075ca",
          "help wanted": "008672",
          question: "d876e3",
          urgent: "e11d48",
          feature: "7c3aed",
        };
        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: labelName,
          color: colors[labelName.toLowerCase()] || "ededed",
        });
        logger.info({ owner, repo, label: labelName }, "Created new label");
      }
    }

    // Add the label
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: [labelName],
    });

    logger.info({ owner, repo, issueNumber, label: labelName }, "Label added successfully");
    return { success: true };
  } catch (error) {
    logger.error({ error: error.message, owner, repo, issueNumber, label: labelName }, "Failed to add label");
    throw error;
  }
}

/**
 * Post a comment on a GitHub issue or pull request.
 */
export async function postComment(userId, owner, repo, issueNumber, body) {
  const octokit = await getOctokit(userId);

  try {
    const { data } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });

    logger.info({ owner, repo, issueNumber, commentId: data.id }, "Comment posted successfully");
    return { success: true, commentId: data.id };
  } catch (error) {
    logger.error({ error: error.message, owner, repo, issueNumber }, "Failed to post comment");
    throw error;
  }
}

/**
 * Create a webhook on a GitHub repository.
 */
export async function createWebhook(userId, owner, repo, webhookUrl, webhookSecret) {
  const octokit = await getOctokit(userId);

  try {
    const { data } = await octokit.rest.repos.createWebhook({
      owner,
      repo,
      config: {
        url: webhookUrl,
        content_type: "json",
        secret: webhookSecret,
        insecure_ssl: "0",
      },
      events: ["issues", "pull_request", "push"],
      active: true,
    });

    logger.info({ owner, repo, webhookId: data.id }, "Webhook created successfully");
    return { success: true, webhookId: data.id };
  } catch (error) {
    logger.error({ error: error.message, owner, repo }, "Failed to create webhook");
    throw error;
  }
}

/**
 * Delete a webhook from a GitHub repository.
 */
export async function deleteWebhook(userId, owner, repo, webhookId) {
  const octokit = await getOctokit(userId);

  try {
    await octokit.rest.repos.deleteWebhook({
      owner,
      repo,
      hook_id: webhookId,
    });

    logger.info({ owner, repo, webhookId }, "Webhook deleted successfully");
    return { success: true };
  } catch (error) {
    logger.error({ error: error.message, owner, repo, webhookId }, "Failed to delete webhook");
    throw error;
  }
}

/**
 * List repositories for the authenticated user.
 */
export async function listUserRepos(userId) {
  const octokit = await getOctokit(userId);

  try {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      type: "owner",
    });

    return data.map((repo) => ({
      id: repo.id,
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      private: repo.private,
      description: repo.description,
      updatedAt: repo.updated_at,
    }));
  } catch (error) {
    logger.error({ error: error.message }, "Failed to list repos");
    throw error;
  }
}
