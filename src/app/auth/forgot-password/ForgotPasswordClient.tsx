"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import CmsText from "@/components/cms/CmsText";
import LoadingBasketball from "@/components/vintage/feedback/LoadingBasketball";
import { usageLogger } from "@/lib/usageLogger";
import {
  formatEmailCopy,
  type VintageAccountPagesCopy,
} from "@/lib/vintage/emailsContent";
import "@/components/auth/auth.css";

/**
 * Password recovery form — copy from Emails & Account CMS.
 */
export default function ForgotPasswordClient({
  copy,
}: {
  copy: VintageAccountPagesCopy;
}) {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    usageLogger.log("Click", copy.forgotSubmitLabel || "Send Reset Instructions", null, email);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        setIsSubmitted(true);
      } else {
        setError(data.error || copy.forgotFailed);
      }
    } catch {
      setError(copy.genericError);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="v-auth" data-testid="forgot-password-success">
        <div className="v-auth__panel">
          <div className="v-auth__body v-auth__success">
            <CheckCircle
              className="mx-auto mb-4 h-12 w-12"
              style={{ color: "#166534" }}
              aria-hidden="true"
            />
            {copy.forgotSuccessHeading ? (
              <h1 className="v-auth__heading">{copy.forgotSuccessHeading}</h1>
            ) : null}
            {copy.forgotSuccessMessage ? (
              <p>
                <CmsText text={formatEmailCopy(copy.forgotSuccessMessage, { email })} />
              </p>
            ) : null}
            {copy.backToSignInLabel ? (
              <Link
                href="/auth/signin"
                className="v-auth__link-btn"
                data-testid="forgot-password-back-signin"
              >
                {copy.backToSignInLabel}
              </Link>
            ) : null}
            {copy.forgotTryAnotherLabel ? (
              <button
                type="button"
                className="v-auth__text-link"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail("");
                }}
                data-testid="forgot-password-try-another"
              >
                {copy.forgotTryAnotherLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v-auth" data-testid="forgot-password-form">
      <div className="v-auth__panel">
        <div className="v-auth__body">
          {copy.forgotHeading ? <h1 className="v-auth__heading">{copy.forgotHeading}</h1> : null}
          {copy.forgotLede ? <p className="v-auth__lede">{copy.forgotLede}</p> : null}
          <form className="v-auth__form" onSubmit={handleSubmit}>
            <div className="v-auth__field">
              {copy.forgotEmailLabel ? (
                <label htmlFor="email" className="v-auth__label">
                  {copy.forgotEmailLabel}
                </label>
              ) : null}
              <div className="v-auth__input-wrap">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="v-auth__input"
                  placeholder={copy.forgotEmailPlaceholder || undefined}
                  data-testid="forgot-password-email-input"
                />
              </div>
            </div>
            {error ? (
              <div className="v-auth__error" role="alert" data-testid="forgot-password-error">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isLoading}
              className="v-auth__submit"
              data-testid="forgot-password-submit"
            >
              {isLoading ? (
                <LoadingBasketball
                  variant="inline"
                  message={copy.forgotSubmitPendingLabel}
                  testId="forgot-password-busy"
                />
              ) : (
                copy.forgotSubmitLabel
              )}
            </button>
            {copy.backToSignInLabel ? (
              <div className="v-auth__footer">
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-1"
                  data-testid="forgot-password-back-link"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {copy.backToSignInLabel}
                </Link>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
