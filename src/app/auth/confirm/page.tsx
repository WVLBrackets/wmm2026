"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { getSiteConfig } from "@/config/site";
import { SiteConfigData } from "@/lib/siteConfig";
import { FALLBACK_CONFIG } from "@/lib/fallbackConfig";
import "@/components/auth/auth.css";

/**
 * Formats CMS copy that uses `||` as an intentional line break.
 */
function formatBreakMessage(msg: string): React.ReactNode {
  const parts = msg.split("||");
  if (parts.length === 1) return msg;
  return parts.map((part, index) => (
    <React.Fragment key={index}>
      {part}
      {index < parts.length - 1 && <br />}
    </React.Fragment>
  ));
}

function ConfirmEmailContent() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);
  const [signInToken, setSignInToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");

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
    if (!siteConfig) {
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("No confirmation token provided");
      return;
    }

    const confirmEmail = async () => {
      try {
        const response = await fetch("/api/auth/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          const configMessage =
            siteConfig?.acctConfirmSuccessMessage1 ||
            FALLBACK_CONFIG.acctConfirmSuccessMessage1 ||
            "";
          setMessage(configMessage.replace(/{email}/g, data.userEmail || ""));

          if (data.userEmail && data.signInToken) {
            setUserEmail(data.userEmail);
            setSignInToken(data.signInToken);
          }
        } else {
          setStatus("error");
          setMessage(data.error || "Failed to confirm email");
        }
      } catch {
        setStatus("error");
        setMessage("An error occurred while confirming your email");
      }
    };

    confirmEmail();
  }, [token, searchParams, siteConfig, router]);

  return (
    <div className="v-auth" data-testid="confirm-email-page">
      <div className="v-auth__panel">
        <div className="v-auth__body v-auth__success">
          {status === "loading" && (
            <>
              <span
                className="v-auth__spinner"
                style={{
                  width: 40,
                  height: 40,
                  margin: "0 auto 16px",
                  borderColor: "color-mix(in srgb, var(--v-ink, #152c3a) 25%, transparent)",
                  borderTopColor: "var(--v-red, #b52c26)",
                  display: "block",
                }}
                aria-hidden="true"
              />
              <h1 className="v-auth__heading">Confirming your email...</h1>
              <p>Please wait while we verify your email address.</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle
                className="mx-auto mb-4 h-12 w-12"
                style={{ color: "#166534" }}
                aria-hidden="true"
              />
              <h1 className="v-auth__heading">
                {siteConfig?.acctConfirmSuccessHeader ||
                  FALLBACK_CONFIG.acctConfirmSuccessHeader}
              </h1>
              <p>{formatBreakMessage(message)}</p>
              <div className="v-auth__form" style={{ marginTop: 16 }}>
                {(siteConfig?.acctConfirmSuccessButton2 ||
                  FALLBACK_CONFIG.acctConfirmSuccessButton2) !== "X" && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!userEmail || !signInToken) {
                        router.push("/auth/signin");
                        return;
                      }

                      setIsSigningIn(true);
                      try {
                        const result = await signIn("credentials", {
                          email: userEmail,
                          password: `AUTO_SIGNIN_TOKEN:${signInToken}`,
                          redirect: false,
                        });

                        if (result?.ok) {
                          router.push("/bracket");
                        } else {
                          router.push("/auth/signin");
                        }
                      } catch {
                        router.push("/auth/signin");
                      } finally {
                        setIsSigningIn(false);
                      }
                    }}
                    disabled={isSigningIn}
                    className="v-auth__submit"
                    data-testid="confirm-go-to-picks"
                    style={{
                      background: "transparent",
                      color: "var(--v-ink, #152c3a)",
                      border: "1px solid var(--v-ink, #152c3a)",
                    }}
                  >
                    {isSigningIn ? (
                      <>
                        <span className="v-auth__spinner" aria-hidden="true" />
                        Signing in...
                      </>
                    ) : (
                      siteConfig?.acctConfirmSuccessButton2 ||
                      FALLBACK_CONFIG.acctConfirmSuccessButton2
                    )}
                  </button>
                )}
                {(siteConfig?.acctConfirmSuccessButton1 ||
                  FALLBACK_CONFIG.acctConfirmSuccessButton1) !== "X" && (
                  <Link
                    href="/auth/signin"
                    className="v-auth__link-btn"
                    data-testid="confirm-sign-in-link"
                  >
                    {siteConfig?.acctConfirmSuccessButton1 ||
                      FALLBACK_CONFIG.acctConfirmSuccessButton1}
                  </Link>
                )}
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle
                className="mx-auto mb-4 h-12 w-12"
                style={{ color: "var(--v-red, #b52c26)" }}
                aria-hidden="true"
              />
              <h1 className="v-auth__heading">
                {siteConfig?.acctConfirmFailureHeader ||
                  FALLBACK_CONFIG.acctConfirmFailureHeader}
              </h1>
              <p>
                {formatBreakMessage(
                  siteConfig?.acctConfirmFailureMessage1 ||
                    FALLBACK_CONFIG.acctConfirmFailureMessage1 ||
                    message,
                )}
              </p>
              <div className="v-auth__form" style={{ marginTop: 16 }}>
                {(siteConfig?.acctConfirmFailureButton1 ||
                  FALLBACK_CONFIG.acctConfirmFailureButton1) !== "X" && (
                  <Link
                    href="/auth/signup"
                    className="v-auth__link-btn"
                    data-testid="confirm-try-signup"
                  >
                    {siteConfig?.acctConfirmFailureButton1 ||
                      FALLBACK_CONFIG.acctConfirmFailureButton1}
                  </Link>
                )}
                {(siteConfig?.acctConfirmFailureButton2 ||
                  FALLBACK_CONFIG.acctConfirmFailureButton2) !== "X" && (
                  <Link
                    href="/auth/signin"
                    className="v-auth__text-link"
                    data-testid="confirm-failure-signin"
                    style={{ marginTop: 8 }}
                  >
                    {siteConfig?.acctConfirmFailureButton2 ||
                      FALLBACK_CONFIG.acctConfirmFailureButton2}
                  </Link>
                )}
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
    <Suspense fallback={null}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
