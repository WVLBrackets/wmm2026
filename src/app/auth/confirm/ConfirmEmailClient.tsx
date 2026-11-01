"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import CmsText from "@/components/cms/CmsText";
import LoadingBasketball from "@/components/vintage/feedback/LoadingBasketball";
import type { VintageAccountPagesCopy } from "@/lib/vintage/emailsContent";
import { formatEmailCopy } from "@/lib/vintage/emailsContent";
import "@/components/auth/auth.css";

function ConfirmEmailContent({ accountCopy }: { accountCopy: VintageAccountPagesCopy }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [signInToken, setSignInToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(accountCopy.confirmFailureMessage);
      return;
    }

    const confirmEmail = async () => {
      try {
        const response = await fetch("/api/auth/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (response.ok) {
          setStatus("success");
          setMessage(
            formatEmailCopy(accountCopy.confirmSuccessMessage, {
              email: data.userEmail || "",
            }),
          );
          if (data.userEmail && data.signInToken) {
            setUserEmail(data.userEmail);
            setSignInToken(data.signInToken);
          }
        } else {
          setStatus("error");
          setMessage(data.error || accountCopy.confirmFailureMessage);
        }
      } catch {
        setStatus("error");
        setMessage(accountCopy.genericError);
      }
    };

    void confirmEmail();
  }, [token, accountCopy]);

  return (
    <div className="v-auth" data-testid="confirm-email-page">
      <div className="v-auth__panel">
        <div className="v-auth__body v-auth__success">
          {status === "loading" && (
            <LoadingBasketball
              message={accountCopy.confirmPendingMessage}
              testId="confirm-loading"
            />
          )}

          {status === "success" && (
            <>
              <CheckCircle
                className="mx-auto mb-4 h-12 w-12"
                style={{ color: "#166534" }}
                aria-hidden="true"
              />
              {accountCopy.confirmSuccessHeading ? (
                <h1 className="v-auth__heading">{accountCopy.confirmSuccessHeading}</h1>
              ) : null}
              {message ? (
                <p>
                  <CmsText text={message} />
                </p>
              ) : null}
              <div className="v-auth__form" style={{ marginTop: 16 }}>
                {accountCopy.confirmSuccessPicksButton ? (
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
                        router.push(result?.ok ? "/bracket" : "/auth/signin");
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
                      <LoadingBasketball
                        variant="plain"
                        message={accountCopy.confirmSigningInLabel}
                      />
                    ) : (
                      accountCopy.confirmSuccessPicksButton
                    )}
                  </button>
                ) : null}
                {accountCopy.confirmSuccessSignInButton ? (
                  <Link
                    href="/auth/signin"
                    className="v-auth__link-btn"
                    data-testid="confirm-sign-in-link"
                  >
                    {accountCopy.confirmSuccessSignInButton}
                  </Link>
                ) : null}
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
              {accountCopy.confirmFailureHeading ? (
                <h1 className="v-auth__heading">{accountCopy.confirmFailureHeading}</h1>
              ) : null}
              <p>
                <CmsText text={message || accountCopy.confirmFailureMessage} />
              </p>
              <div className="v-auth__form" style={{ marginTop: 16 }}>
                {accountCopy.confirmFailureSignUpButton ? (
                  <Link
                    href="/auth/signup"
                    className="v-auth__link-btn"
                    data-testid="confirm-try-signup"
                  >
                    {accountCopy.confirmFailureSignUpButton}
                  </Link>
                ) : null}
                {accountCopy.confirmFailureSignInButton ? (
                  <Link
                    href="/auth/signin"
                    className="v-auth__text-link"
                    data-testid="confirm-failure-signin"
                    style={{ marginTop: 8 }}
                  >
                    {accountCopy.confirmFailureSignInButton}
                  </Link>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailClient({
  accountCopy,
}: {
  accountCopy: VintageAccountPagesCopy;
}) {
  return (
    <Suspense fallback={<LoadingBasketball message={accountCopy.confirmPendingMessage} />}>
      <ConfirmEmailContent accountCopy={accountCopy} />
    </Suspense>
  );
}
