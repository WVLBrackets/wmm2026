"use client";

import React, { Suspense, useEffect, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { getSiteConfig } from "@/config/site";
import { SiteConfigData } from "@/lib/siteConfig";
import { FALLBACK_CONFIG } from "@/lib/fallbackConfig";
import { LoggedButton } from "@/components/LoggedButton";
import { usageLogger } from "@/lib/usageLogger";
import {
  defaultVintagePicksAuthCopy,
  type VintagePicksAuthCopy,
} from "@/lib/vintage/picksContent";
import "./auth.css";

type AuthTab = "signin" | "signup";

/**
 * Formats CMS success copy that uses `||` as an intentional line break.
 */
function formatBreakMessage(msg: string, email?: string): React.ReactNode {
  const resolved = email ? msg.replace(/{email}/g, email) : msg;
  const parts = resolved.split("||");
  if (parts.length === 1) return resolved;
  return parts.map((part, index) => (
    <React.Fragment key={index}>
      {part}
      {index < parts.length - 1 && <br />}
    </React.Fragment>
  ));
}

/**
 * Unified Sign In / Create Account forms with vintage presentation.
 * Labels come from My Picks CMS (`auth`); handlers stay on NextAuth / register.
 */
export default function AuthFormsWrapper({
  authCopy,
}: {
  authCopy?: VintagePicksAuthCopy;
}) {
  const copy = authCopy ?? defaultVintagePicksAuthCopy();
  return (
    <Suspense fallback={null}>
      <AuthForms authCopy={copy} />
    </Suspense>
  );
}

function AuthForms({ authCopy }: { authCopy: VintagePicksAuthCopy }) {
  const signInCopy = authCopy.signIn;
  const createCopy = authCopy.createAccount;
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMode =
    searchParams?.get("mode") === "signup" ? "signup" : "signin";

  const [activeTab, setActiveTab] = useState<AuthTab>(initialMode);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState("");

  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] =
    useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpError, setSignUpError] = useState("");
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getSiteConfig();
        setSiteConfig(config);
      } catch (error) {
        console.error("Failed to load site config:", error);
        setSiteConfig(FALLBACK_CONFIG);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    const mode =
      searchParams?.get("mode") === "signup" ? "signup" : "signin";
    setActiveTab(mode);
  }, [searchParams]);

  /**
   * Switches Sign In / Create Account tabs and syncs the URL mode param.
   */
  const handleTabSwitch = (tab: AuthTab) => {
    setActiveTab(tab);
    setSignInError("");
    setSignUpError("");
    const href =
      tab === "signup" ? "/auth/signin?mode=signup" : "/auth/signin";
    router.replace(href, { scroll: false });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInLoading(true);
    setSignInError("");

    try {
      const result = await signIn("credentials", {
        email: signInEmail,
        password: signInPassword,
        redirect: false,
      });

      if (result?.error) {
        try {
          const checkResponse = await fetch("/api/auth/check-email-confirmed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: signInEmail }),
          });
          const checkData = await checkResponse.json();
          if (checkData.exists && !checkData.confirmed) {
            setSignInError(
              siteConfig?.emailFailNotConfirmed ||
                FALLBACK_CONFIG.emailFailNotConfirmed ||
                "Please confirm your email address before signing in.",
            );
          } else {
            setSignInError(
              siteConfig?.emailFailInvalid ||
                FALLBACK_CONFIG.emailFailInvalid ||
                "Invalid email or password",
            );
          }
        } catch {
          setSignInError(
            siteConfig?.emailFailInvalid ||
              FALLBACK_CONFIG.emailFailInvalid ||
              "Invalid email or password",
          );
        }
      } else {
        const session = await getSession();
        if (session) {
          router.push("/bracket");
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "EMAIL_NOT_CONFIRMED") {
          setSignInError(
            siteConfig?.emailFailNotConfirmed ||
              FALLBACK_CONFIG.emailFailNotConfirmed ||
              "Please confirm your email address before signing in.",
          );
        } else if (error.message.startsWith("Too many login attempts")) {
          setSignInError(error.message);
        } else {
          setSignInError("An error occurred. Please try again.");
        }
      } else {
        setSignInError("An error occurred. Please try again.");
      }
    } finally {
      setSignInLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpLoading(true);
    setSignUpError("");

    usageLogger.log("Click", "Create Account", null, signUpEmail);

    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpError(createCopy.passwordsMismatch);
      setSignUpLoading(false);
      return;
    }

    if (signUpPassword.length < 6) {
      setSignUpError(createCopy.passwordTooShort);
      setSignUpLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signUpName,
          email: signUpEmail,
          password: signUpPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSignUpSuccess(true);
      } else {
        setSignUpError(data.error || "Failed to create account");
      }
    } catch {
      setSignUpError("An error occurred. Please try again.");
    } finally {
      setSignUpLoading(false);
    }
  };

  if (signUpSuccess) {
    const spamReminder =
      siteConfig?.regEmailSpamReminder ||
      FALLBACK_CONFIG.regEmailSpamReminder ||
      "";
    let reminderText = spamReminder
      .replace(/^💡\s*/, "")
      .replace(/<strong>.*?<\/strong>\s*/i, "")
      .replace(/Can&apos;t find (the|this) email\?\s*/i, "")
      .replace(/Can't find (the|this) email\?\s*/i, "")
      .trim();
    if (!reminderText) {
      reminderText =
        "Please check your spam or junk mail folder. If you still don't see it, the email may take a few minutes to arrive.";
    }

    return (
      <div className="v-auth" data-testid="auth-signup-success">
        <div className="v-auth__panel">
          <div className="v-auth__body v-auth__success">
            <div className="v-auth__success-icon" aria-hidden="true">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1
              className="v-auth__heading"
              data-testid="signup-success-header"
            >
              {siteConfig?.acctCreateSuccessHeader ||
                FALLBACK_CONFIG.acctCreateSuccessHeader}
            </h1>
            <p>
              {formatBreakMessage(
                siteConfig?.acctCreateSuccessMessage1 ||
                  FALLBACK_CONFIG.acctCreateSuccessMessage1 ||
                  "",
                signUpEmail,
              )}
            </p>
            <p>
              {formatBreakMessage(
                siteConfig?.acctCreateSuccessMessage2 ||
                  FALLBACK_CONFIG.acctCreateSuccessMessage2 ||
                  "",
              )}
            </p>
            <div className="v-auth__note">
              <strong>Can&apos;t find the email?</strong> {reminderText}
            </div>
            <Link
              href="/auth/signin"
              className="v-auth__link-btn"
              data-testid="signup-success-signin-link"
            >
              {siteConfig?.acctCreateSuccessButton ||
                FALLBACK_CONFIG.acctCreateSuccessButton}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v-auth" data-testid="auth-forms">
      <div className="v-auth__panel">
        <div className="v-auth__tabs" role="tablist" aria-label="Account">
          <button
            type="button"
            role="tab"
            id="auth-tab-signin"
            aria-selected={activeTab === "signin"}
            aria-controls="auth-panel-signin"
            tabIndex={activeTab === "signin" ? 0 : -1}
            onClick={() => handleTabSwitch("signin")}
            data-testid="auth-tab-signin"
            className="v-auth__tab"
          >
            {signInCopy.tabLabel}
          </button>
          <button
            type="button"
            role="tab"
            id="auth-tab-signup"
            aria-selected={activeTab === "signup"}
            aria-controls="auth-panel-signup"
            tabIndex={activeTab === "signup" ? 0 : -1}
            onClick={() => handleTabSwitch("signup")}
            data-testid="auth-tab-signup"
            className="v-auth__tab"
          >
            {createCopy.tabLabel}
          </button>
        </div>

        <div className="v-auth__body">
          {activeTab === "signin" && (
            <div
              role="tabpanel"
              id="auth-panel-signin"
              aria-labelledby="auth-tab-signin"
            >
              <h1 className="v-auth__heading">{signInCopy.heading}</h1>
              <p className="v-auth__lede">{signInCopy.lede}</p>

              <form className="v-auth__form" onSubmit={handleSignIn} noValidate>
                <div className="v-auth__field">
                  <label htmlFor="signin-email" className="v-auth__label">
                    {signInCopy.emailLabel}
                  </label>
                  <div className="v-auth__input-wrap">
                    <input
                      id="signin-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      className="v-auth__input"
                      placeholder={signInCopy.emailPlaceholder}
                      data-testid="signin-email-input"
                    />
                  </div>
                </div>

                <div className="v-auth__field">
                  <label htmlFor="signin-password" className="v-auth__label">
                    {signInCopy.passwordLabel}
                  </label>
                  <div className="v-auth__input-wrap">
                    <input
                      id="signin-password"
                      name="password"
                      type={showSignInPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      className="v-auth__input v-auth__input--with-toggle"
                      placeholder={signInCopy.passwordPlaceholder}
                      data-testid="signin-password-input"
                    />
                    <button
                      type="button"
                      className="v-auth__toggle"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      aria-label={
                        showSignInPassword ? "Hide password" : "Show password"
                      }
                      data-testid="signin-password-toggle"
                    >
                      {showSignInPassword ? (
                        <EyeOff className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {signInError && (
                  <div
                    className="v-auth__error"
                    role="alert"
                    data-testid="signin-error-message"
                  >
                    {signInError}
                  </div>
                )}

                <LoggedButton
                  type="submit"
                  disabled={signInLoading}
                  logLocation="Sign In"
                  className="v-auth__submit"
                  data-testid="signin-submit-button"
                >
                  {signInLoading ? (
                    <>
                      <span className="v-auth__spinner" aria-hidden="true" />
                      {signInCopy.submitPendingLabel}
                    </>
                  ) : (
                    signInCopy.submitLabel
                  )}
                </LoggedButton>

                <div className="v-auth__footer">
                  <Link
                    href="/auth/forgot-password"
                    data-testid="forgot-password-link"
                  >
                    {signInCopy.forgotPasswordLink}
                  </Link>
                  <p>
                    {signInCopy.footerPrompt}{" "}
                    <button
                      type="button"
                      className="v-auth__text-link"
                      onClick={() => handleTabSwitch("signup")}
                      data-testid="auth-footer-create-account"
                    >
                      {signInCopy.footerLink}
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}

          {activeTab === "signup" && (
            <div
              role="tabpanel"
              id="auth-panel-signup"
              aria-labelledby="auth-tab-signup"
            >
              <h1 className="v-auth__heading">{createCopy.heading}</h1>
              <p className="v-auth__lede">{createCopy.lede}</p>

              <form
                className="v-auth__form"
                onSubmit={handleSignUp}
                method="post"
                action=""
                noValidate
              >
                <div className="v-auth__field">
                  <label htmlFor="signup-name" className="v-auth__label">
                    {createCopy.nameLabel}
                  </label>
                  <div className="v-auth__input-wrap">
                    <input
                      id="signup-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      data-testid="signup-name-input"
                      className="v-auth__input"
                      placeholder={createCopy.namePlaceholder}
                    />
                  </div>
                </div>

                <div className="v-auth__field">
                  <label htmlFor="signup-email" className="v-auth__label">
                    {createCopy.emailLabel}
                  </label>
                  <div className="v-auth__input-wrap">
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      data-testid="signup-email-input"
                      className="v-auth__input"
                      placeholder={createCopy.emailPlaceholder}
                    />
                  </div>
                </div>

                <div className="v-auth__field">
                  <label htmlFor="signup-password" className="v-auth__label">
                    {createCopy.passwordLabel}
                  </label>
                  <div className="v-auth__input-wrap">
                    <input
                      id="signup-password"
                      name="password"
                      type={showSignUpPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      data-testid="signup-password-input"
                      className="v-auth__input v-auth__input--with-toggle"
                      placeholder={createCopy.passwordPlaceholder}
                    />
                    <button
                      type="button"
                      className="v-auth__toggle"
                      onClick={() =>
                        setShowSignUpPassword(!showSignUpPassword)
                      }
                      aria-label={
                        showSignUpPassword ? "Hide password" : "Show password"
                      }
                      data-testid="signup-password-toggle"
                    >
                      {showSignUpPassword ? (
                        <EyeOff className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="v-auth__field">
                  <label
                    htmlFor="signup-confirm-password"
                    className="v-auth__label"
                  >
                    {createCopy.confirmPasswordLabel}
                  </label>
                  <div className="v-auth__input-wrap">
                    <input
                      id="signup-confirm-password"
                      name="confirmPassword"
                      type={showSignUpConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={signUpConfirmPassword}
                      onChange={(e) =>
                        setSignUpConfirmPassword(e.target.value)
                      }
                      data-testid="signup-confirm-password-input"
                      className="v-auth__input v-auth__input--with-toggle"
                      placeholder={createCopy.confirmPasswordPlaceholder}
                    />
                    <button
                      type="button"
                      className="v-auth__toggle"
                      onClick={() =>
                        setShowSignUpConfirmPassword(
                          !showSignUpConfirmPassword,
                        )
                      }
                      aria-label={
                        showSignUpConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      data-testid="signup-confirm-password-toggle"
                    >
                      {showSignUpConfirmPassword ? (
                        <EyeOff className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {signUpError && (
                  <div
                    className="v-auth__error"
                    role="alert"
                    data-testid="signup-error-message"
                  >
                    {signUpError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={signUpLoading}
                  data-testid="signup-submit-button"
                  className="v-auth__submit"
                >
                  {signUpLoading ? (
                    <>
                      <span className="v-auth__spinner" aria-hidden="true" />
                      {createCopy.submitPendingLabel}
                    </>
                  ) : (
                    createCopy.submitLabel
                  )}
                </button>

                <div className="v-auth__footer">
                  <hr className="v-auth__divider" />
                  <p>
                    {createCopy.footerPrompt}{" "}
                    <button
                      type="button"
                      className="v-auth__text-link"
                      onClick={() => handleTabSwitch("signin")}
                      data-testid="auth-footer-sign-in"
                    >
                      {createCopy.footerLink}
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
