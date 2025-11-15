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

          // Special case: Check if this is an auto-signin token
          if (password.startsWith('AUTO_SIGNIN_TOKEN:')) {
            const signInToken = password.substring('AUTO_SIGNIN_TOKEN:'.length);
            const { sql } = await import('@/lib/databaseAdapter');
            const { getCurrentEnvironment } = await import('@/lib/databaseConfig');
            
            const environment = getCurrentEnvironment();
            
            // Verify the sign-in token is valid
            const tokenResult = await sql`
              SELECT t.user_id, u.email, u.name
              FROM tokens t
              JOIN users u ON u.id = t.user_id
              WHERE t.token = ${signInToken} 
                AND t.type = 'auto_signin' 
                AND t.expires > NOW() 
                AND t.environment = ${environment}
                AND u.email = ${email}
                AND u.email_confirmed = TRUE
            `;
            
            if (tokenResult.rows.length > 0) {
              const row = tokenResult.rows[0];
              
              // Delete the token after use (one-time use)
              await sql`
                DELETE FROM tokens WHERE token = ${signInToken}
              `;
              
              console.log('Auth: User authenticated via auto-signin token:', row.email);
              return {
                id: row.user_id,
                email: row.email,
                name: row.name,
              };
            }
            
            console.log('Auth: Invalid auto-signin token');
            return null;
          }

          console.log('Auth: Attempting to verify password for:', email);
          const result = await verifyPassword(email, password);
          if (!result.user) {
            if (result.error === 'not_confirmed') {
              console.log('Auth: User email not confirmed for:', credentials.email);
              // Return a special error object that NextAuth will pass through
              // We'll check for this in the signin page
              const error = new Error('EMAIL_NOT_CONFIRMED');
              // @ts-expect-error - Adding custom property to error
              error.code = 'EMAIL_NOT_CONFIRMED';
              throw error;
            }
            console.log('Auth: User not found or password invalid for:', credentials.email);
            return null;
          }

          console.log('Auth: User authenticated successfully:', result.user.email);
          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
          };
        } catch (error) {
          console.error('Auth: Error during authorization:', error);
          // Re-throw EMAIL_NOT_CONFIRMED errors so they can be caught
          if (error instanceof Error && (error.message === 'EMAIL_NOT_CONFIRMED' || (error as { code?: string }).code === 'EMAIL_NOT_CONFIRMED')) {
            throw error;
          }
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
  get secret() {
    // Lazy evaluation: only check when secret is actually accessed
    return getAuthSecret();
  },
};

