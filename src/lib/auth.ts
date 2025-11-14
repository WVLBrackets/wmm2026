import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyPassword } from './secureDatabase';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log('Auth: Missing credentials');
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          console.log('Auth: Attempting to verify password for:', email);
          const user = await verifyPassword(email, password);
          if (!user) {
            console.log('Auth: User not found or password invalid for:', credentials.email);
            return null;
          }

          console.log('Auth: User authenticated successfully:', user.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error('Auth: Error during authorization:', error);
          return null;
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Always redirect to the same origin (whatever port the server is running on)
      // If url is relative, use it with the current baseUrl
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // Parse both URLs to compare origins
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        // If the url is on the same origin (same host, regardless of port), return it
        if (urlObj.origin === baseUrlObj.origin) {
          return url;
        }
      } catch {
        // If URL parsing fails, fallback to baseUrl
      }
      // Otherwise, redirect to base URL
      return baseUrl;
    },
        async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
      }
      return token;
    },
        async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development',
};

