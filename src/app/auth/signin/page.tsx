'use client';

import React, { useState, useEffect } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { getSiteConfig } from '@/config/site';
import { SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { LoggedButton } from '@/components/LoggedButton';
import { usageLogger } from '@/lib/usageLogger';

type AuthTab = 'signin' | 'signup';

export default function AuthPage() {
  const searchParams = useSearchParams();
  const initialMode = searchParams?.get('mode') === 'signup' ? 'signup' : 'signin';

  const [activeTab, setActiveTab] = useState<AuthTab>(initialMode);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);
  const router = useRouter();

  // Sign-in state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState('');

  // Sign-up state
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);

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

  /** Clear errors when switching tabs */
  const handleTabSwitch = (tab: AuthTab) => {
    setActiveTab(tab);
    setSignInError('');
    setSignUpError('');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInLoading(true);
    setSignInError('');

    try {
      const result = await signIn('credentials', {
        email: signInEmail,
        password: signInPassword,
        redirect: false,
      });

      if (result?.error) {
        try {
          const checkResponse = await fetch('/api/auth/check-email-confirmed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: signInEmail }),
          });
          const checkData = await checkResponse.json();
          if (checkData.exists && !checkData.confirmed) {
            setSignInError(siteConfig?.emailFailNotConfirmed || FALLBACK_CONFIG.emailFailNotConfirmed || 'Please confirm your email address before signing in.');
          } else {
            setSignInError(siteConfig?.emailFailInvalid || FALLBACK_CONFIG.emailFailInvalid || 'Invalid email or password');
          }
        } catch {
          setSignInError(siteConfig?.emailFailInvalid || FALLBACK_CONFIG.emailFailInvalid || 'Invalid email or password');
        }
      } else {
        const session = await getSession();
        if (session) {
          router.push('/bracket');
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'EMAIL_NOT_CONFIRMED') {
          setSignInError(siteConfig?.emailFailNotConfirmed || FALLBACK_CONFIG.emailFailNotConfirmed || 'Please confirm your email address before signing in.');
        } else if (error.message.startsWith('Too many login attempts')) {
          setSignInError(error.message);
        } else {
          setSignInError('An error occurred. Please try again.');
        }
      } else {
        setSignInError('An error occurred. Please try again.');
      }
    } finally {
      setSignInLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpLoading(true);
    setSignUpError('');

    usageLogger.log('Click', 'Create Account', null, signUpEmail);

    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpError('Passwords do not match');
      setSignUpLoading(false);
      return;
    }

    if (signUpPassword.length < 6) {
      setSignUpError('Password must be at least 6 characters');
      setSignUpLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: signUpName, email: signUpEmail, password: signUpPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setSignUpSuccess(true);
      } else {
        setSignUpError(data.error || 'Failed to create account');
      }
    } catch {
      setSignUpError('An error occurred. Please try again.');
    } finally {
      setSignUpLoading(false);
    }
  };

  if (signUpSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900" data-testid="signup-success-header">
              {siteConfig?.acctCreateSuccessHeader || FALLBACK_CONFIG.acctCreateSuccessHeader}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {(() => {
                const msg = (siteConfig?.acctCreateSuccessMessage1 || FALLBACK_CONFIG.acctCreateSuccessMessage1 || '').replace(/{email}/g, signUpEmail);
                const parts = msg.split('||');
                if (parts.length === 1) return msg;
                return parts.map((part, index) => (
                  <React.Fragment key={index}>
                    {part}
                    {index < parts.length - 1 && <br />}
                  </React.Fragment>
                ));
              })()}
            </p>
            <p className="mt-2 text-center text-sm text-gray-600">
              {(() => {
                const msg = siteConfig?.acctCreateSuccessMessage2 || FALLBACK_CONFIG.acctCreateSuccessMessage2 || '';
                const parts = msg.split('||');
                if (parts.length === 1) return msg;
                return parts.map((part, index) => (
                  <React.Fragment key={index}>
                    {part}
                    {index < parts.length - 1 && <br />}
                  </React.Fragment>
                ));
              })()}
            </p>
            <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <p className="text-sm text-yellow-800 text-center">
                {(() => {
                  const spamReminder = siteConfig?.regEmailSpamReminder || FALLBACK_CONFIG.regEmailSpamReminder || '';
                  let reminderText = spamReminder
                    .replace(/^💡\s*/, '')
                    .replace(/<strong>.*?<\/strong>\s*/i, '')
                    .replace(/Can&apos;t find (the|this) email\?\s*/i, '')
                    .replace(/Can't find (the|this) email\?\s*/i, '')
                    .trim();
                  if (!reminderText) {
                    reminderText = 'Please check your spam or junk mail folder. If you still don\'t see it, the email may take a few minutes to arrive.';
                  }
                  return (
                    <>
                      💡 <strong>Can&apos;t find the email?</strong> {reminderText}
                    </>
                  );
                })()}
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/auth/signin"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
              >
                {siteConfig?.acctCreateSuccessButton || FALLBACK_CONFIG.acctCreateSuccessButton}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center pt-4 pb-12 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Tab toggle */}
        <div className="flex rounded-lg overflow-hidden border-2 border-blue-600 shadow-sm">
          <button
            type="button"
            onClick={() => handleTabSwitch('signin')}
            data-testid="auth-tab-signin"
            className={`flex-1 py-3 text-sm font-semibold transition-colors duration-150 ${
              activeTab === 'signin'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('signup')}
            data-testid="auth-tab-signup"
            className={`flex-1 py-3 text-sm font-semibold transition-colors duration-150 ${
              activeTab === 'signup'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Sign In form */}
        {activeTab === 'signin' && (
          <form className="space-y-5" onSubmit={handleSignIn}>
            <div className="space-y-4">
              <div>
                <label htmlFor="signin-email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signin-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="appearance-none rounded-md relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signin-password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signin-password"
                    name="password"
                    type={showSignInPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="appearance-none rounded-md relative block w-full pl-10 pr-10 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                  >
                    {showSignInPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {signInError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{signInError}</p>
              </div>
            )}

            <div>
              <LoggedButton
                type="submit"
                disabled={signInLoading}
                logLocation="Sign In"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signInLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </LoggedButton>
            </div>

            <div className="text-center">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500 cursor-pointer"
              >
                Forgot your password?
              </Link>
            </div>

            {siteConfig?.signinFooter && (
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {siteConfig.signinFooter}
                </p>
              </div>
            )}
          </form>
        )}

        {/* Create Account form */}
        {activeTab === 'signup' && (
          <form className="space-y-5" onSubmit={handleSignUp} method="post" action="">
            <div className="space-y-4">
              <div>
                <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signup-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    data-testid="signup-name-input"
                    className="appearance-none rounded-md relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    data-testid="signup-email-input"
                    className="appearance-none rounded-md relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signup-password"
                    name="password"
                    type={showSignUpPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    data-testid="signup-password-input"
                    className="appearance-none rounded-md relative block w-full pl-10 pr-10 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                  >
                    {showSignUpPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showSignUpConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    data-testid="signup-confirm-password-input"
                    className="appearance-none rounded-md relative block w-full pl-10 pr-10 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowSignUpConfirmPassword(!showSignUpConfirmPassword)}
                  >
                    {showSignUpConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {signUpError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3" data-testid="signup-error-message">
                <p className="text-sm text-red-600">{signUpError}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={signUpLoading}
                data-testid="signup-submit-button"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signUpLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating account...
                  </div>
                ) : (
                  'Create account'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
