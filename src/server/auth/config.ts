import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db/client";
import { SignInRequestSchema } from "@/lib/schemas";
import { findUserByEmail } from "@/server/repositories/user.repo";
import { verifyPassword } from "./password";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  // Auth.js v5 requires JWT strategy when Credentials provider is the only
  // sign-in path — DB sessions are only writable by adapter-driven providers
  // (OAuth + email-link). Token TTL still 30 days; the cookie payload is a
  // signed JWT containing the user id.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/verify-email",
    error: "/sign-in",
  },
  cookies: {
    sessionToken: {
      name: "ynot.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(input) {
        const parsed = SignInRequestSchema.safeParse(input);
        if (!parsed.success) return null;
        const user = await findUserByEmail(parsed.data.email);
        if (!user || !user.passwordHash) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (!user.emailVerifiedAt) {
          // Surface a specific error code so the route handler can route the
          // client to /verify-email rather than showing a generic credentials
          // error.
          throw new Error("EMAIL_NOT_VERIFIED");
        }
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      // On sign-in, copy the user id into the token so subsequent reads can
      // resolve it without another DB query.
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token?.id && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
};
