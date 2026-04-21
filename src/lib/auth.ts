import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request Drive + Sheets + Gmail scopes so we can read/write later
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/gmail.send",
          ].join(" "),
          prompt:        "consent",
          access_type:   "offline",
          response_type: "code",
        },
      },
    }),
  ],

  // Store the Google access token in the JWT so API routes can use it
  callbacks: {
    async jwt({ token, account }) {
      // On initial sign-in, capture all credentials
      if (account) {
        return {
          ...token,
          accessToken:  account.access_token,
          refreshToken: account.refresh_token,
          expiresAt:    account.expires_at,
        };
      }

      // Return existing token if it hasn't expired yet (with 60s buffer)
      if (typeof token.expiresAt === "number" && Date.now() < (token.expiresAt as number) * 1000 - 60_000) {
        return token;
      }

      // Token has expired — refresh it using the stored refresh_token
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id:     process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type:    "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw data;

        return {
          ...token,
          accessToken: data.access_token,
          expiresAt:   Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
          refreshToken: data.refresh_token ?? token.refreshToken,
        };
      } catch (error) {
        console.error("[SocialOS] Token refresh failed:", error);
        // Return the old token — downstream will get a 401 and prompt re-login
        return { ...token, error: "RefreshAccessTokenError" };
      }
    },
    async session({ session, token }) {
      // Expose accessToken to server-side API routes via getServerSession()
      (session as any).accessToken  = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      if (token.error) (session as any).error = token.error;
      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",   // our custom sign-in page
    error:  "/auth/signin",   // redirect errors back to sign-in
  },

  session: { strategy: "jwt" },

  secret: process.env.NEXTAUTH_SECRET,
};