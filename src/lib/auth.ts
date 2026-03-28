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
            "https://www.googleapis.com/auth/drive.readonly",
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
      if (account) {
        token.accessToken  = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt    = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose accessToken to server-side API routes via getServerSession()
      (session as any).accessToken  = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
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