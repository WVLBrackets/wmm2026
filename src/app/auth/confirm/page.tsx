'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { getSiteConfig } from '@/config/site';
import { SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

function ConfirmEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);
  const [signInToken, setSignInToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get('token');

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getSiteConfig();
        setSiteConfig(config);
      } catch (error) {
        console.error('Failed to load site config:', error);
        setSiteConfig(FALLBACK_CONFIG);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (!siteConfig) {
      // Wait for config to load
      return;
    }
    
    console.log('ConfirmEmailContent: token =', token);
    console.log('ConfirmEmailContent: searchParams =', searchParams?.toString());
    
    if (!token) {
      setStatus('error');
      setMessage('No confirmation token provided');
      return;
    }

    const confirmEmail = async () => {
      try {
        const response = await fetch('/api/auth/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          const configMessage = siteConfig?.acctConfirmSuccessMessage1 || FALLBACK_CONFIG.acctConfirmSuccessMessage1 || '';
          setMessage(configMessage.replace(/{email}/g, data.userEmail || ''));
          
          // Store the sign-in token and email for use when user clicks "Go to My Picks"
          if (data.userEmail && data.signInToken) {
            setUserEmail(data.userEmail);
            setSignInToken(data.signInToken);
          }
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to confirm email');
        }
      } catch {
        setStatus('error');
        setMessage('An error occurred while confirming your email');
      }
    };

    confirmEmail();
  }, [token, searchParams, siteConfig, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                Confirming your email...
              </h2>
              <p className="text-sm text-gray-600">
                Please wait while we verify your email address.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                {siteConfig?.acctConfirmSuccessHeader || FALLBACK_CONFIG.acctConfirmSuccessHeader}
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                {/* Button 2 first (Go to My Picks) */}
                {(siteConfig?.acctConfirmSuccessButton2 || FALLBACK_CONFIG.acctConfirmSuccessButton2) !== 'X' && (
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!userEmail || !signInToken) {
                        // Fallback: redirect to sign in if we don't have the token
                        router.push('/auth/signin');
                        return;
                      }
                      
                      setIsSigningIn(true);
                      try {
                        // Use the temporary sign-in token for auto-sign in
                        const result = await signIn('credentials', {
                          email: userEmail,
                          password: `AUTO_SIGNIN_TOKEN:${signInToken}`,
                          redirect: false,
                        });
                        
                        if (result?.ok) {
                          // Successfully signed in, redirect to bracket page
                          router.push('/bracket');
                        } else {
                          // Auto-sign in failed, redirect to sign in page
                          console.log('Auto-sign in failed, redirecting to sign in');
                          router.push('/auth/signin');
                        }
                      } catch (signInError) {
                        console.error('Error during auto-sign in:', signInError);
                        // Redirect to sign in page on error
                        router.push('/auth/signin');
                      } finally {
                        setIsSigningIn(false);
                      }
                    }}
                    disabled={isSigningIn}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSigningIn ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                        Signing in...
                      </div>
                    ) : (
                      siteConfig?.acctConfirmSuccessButton2 || FALLBACK_CONFIG.acctConfirmSuccessButton2
                    )}
                  </button>
                )}
                {/* Button 1 second (Sign In Now) */}
                {(siteConfig?.acctConfirmSuccessButton1 || FALLBACK_CONFIG.acctConfirmSuccessButton1) !== 'X' && (
                  <Link
                    href="/auth/signin"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {siteConfig?.acctConfirmSuccessButton1 || FALLBACK_CONFIG.acctConfirmSuccessButton1}
                  </Link>
                )}
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                Confirmation Failed
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <Link
                  href="/auth/signup"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                >
                  Try Signing Up Again
                </Link>
                <Link
                  href="/auth/signin"
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                >
                  Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmEmailContent />
    </Suspense>
  );
}

