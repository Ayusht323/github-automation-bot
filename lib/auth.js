import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/lib/db";
import { users, accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import logger from "@/lib/logger";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        try {
          // 1. Upsert user with GitHub-specific fields
          const existing = await db
            .select()
            .from(users)
            .where(eq(users.githubId, profile.id))
            .limit(1);

          let dbUserId;
          if (existing.length === 0) {
            const [newUser] = await db
              .insert(users)
              .values({
                githubId: profile.id,
                username: profile.login,
                displayName: profile.name || profile.login,
                avatarUrl: profile.avatar_url,
              })
              .returning();
            dbUserId = newUser.id;
          } else {
            const [updatedUser] = await db
              .update(users)
              .set({
                username: profile.login,
                displayName: profile.name || profile.login,
                avatarUrl: profile.avatar_url,
                updatedAt: new Date(),
              })
              .where(eq(users.githubId, profile.id))
              .returning();
            dbUserId = updatedUser.id;
          }

          // 2. Upsert the account and access token manually
          const existingAccount = await db
            .select()
            .from(accounts)
            .where(
              and(
                eq(accounts.provider, account.provider),
                eq(accounts.providerAccountId, account.providerAccountId)
              )
            )
            .limit(1);

          if (existingAccount.length === 0) {
            await db.insert(accounts).values({
              userId: dbUserId,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              accessToken: account.access_token,
              tokenType: account.token_type,
              scope: account.scope,
            });
          } else {
            await db
              .update(accounts)
              .set({
                accessToken: account.access_token,
                tokenType: account.token_type,
                scope: account.scope,
              })
              .where(eq(accounts.id, existingAccount[0].id));
          }

          // 3. Attach our internal DB values to the Auth.js user object (to pass to JWT)
          user.dbId = dbUserId;
          user.username = profile.login;
          user.githubId = profile.id;
          user.avatarUrl = profile.avatar_url;
        } catch (error) {
          logger.error({ error: error.message }, "Error during sign in");
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // User object is only available on initial sign in
      if (user) {
        token.dbId = user.dbId;
        token.username = user.username;
        token.githubId = user.githubId;
        token.avatarUrl = user.avatarUrl;
      }
      return token;
    },
    async session({ session, token }) {
      // Attach our internal user data from the JWT token to the session
      if (token) {
        session.user.dbId = token.dbId;
        session.user.username = token.username;
        session.user.githubId = token.githubId;
        session.user.avatarUrl = token.avatarUrl;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
