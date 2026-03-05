import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import bcrypt from "bcryptjs";

const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : [];

const lineProvider =
  process.env.LINE_CLIENT_ID && process.env.LINE_CLIENT_SECRET
    ? [
        {
          id: "line",
          name: "LINE",
          type: "oauth" as const,
          authorization: {
            url: "https://access.line.me/oauth2/v2.1/authorize",
            params: { scope: "profile openid email", bot_prompt: "normal" },
          },
          token: "https://api.line.me/oauth2/v2.1/token",
          userinfo: "https://api.line.me/v2/profile",
          checks: ["state"] as ["state"],
          clientId: process.env.LINE_CLIENT_ID,
          clientSecret: process.env.LINE_CLIENT_SECRET,
          profile(profile: { userId: string; displayName: string; pictureUrl?: string }) {
            return {
              id: profile.userId,
              name: profile.displayName,
              image: profile.pictureUrl,
            };
          },
        },
      ]
    : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Prisma アダプターなし → JWT のみで動作（DB 不要）
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...googleProvider,
    ...lineProvider,
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email as string;
        const password = credentials.password as string;

        // Firestore からユーザーを検索
        const q = query(collection(db, "users"), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        if (!userData.password) return null;

        const isValid = await bcrypt.compare(password, userData.password);
        if (!isValid) return null;

        return {
          id: userDoc.id,
          name: userData.name,
          email: userData.email,
          image: userData.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id;
      }
      if (account?.provider === "google" && profile) {
        const p = profile as { sub?: string; name?: string; email?: string; picture?: string };
        token.id = p.sub ?? token.id;
        token.picture = p.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      if (token?.picture) {
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
});

