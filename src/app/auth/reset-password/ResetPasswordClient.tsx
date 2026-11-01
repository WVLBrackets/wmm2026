"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import LoadingBasketball from "@/components/vintage/feedback/LoadingBasketball";
import type { VintageAccountPagesCopy } from "@/lib/vintage/emailsContent";
import "@/components/auth/auth.css";

function ResetPasswordContent({ copy }: { copy: VintageAccountPagesCopy }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");

  useEffect(() => {
    if (!token) setError(copy.resetMissingToken);
  }, [token, copy.resetMissingToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    if (password !== confirmPassword) {
      setError(copy.resetFailed);
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError(copy.resetFailed);
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
        window.setTimeout(() => {
          router.push("/auth/signin");
        }, 3000);
      } else {
        setError(data.error || copy.resetFailed);
      }
    } catch {
      setError(copy.genericError);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="v-auth" data-testid="reset-password-success">
        <div className="v-auth__panel">
          <div className="v-auth__body v-auth__success">
            <CheckCircle
              className="mx-auto mb-4 h-12 w-12"
              style={{ color: "#166534" }}
              aria-hidden="true"
            />
            {copy.resetSuccessHeading ? (
              <h1 className="v-auth__heading">{copy.resetSuccessHeading}</h1>
            ) : null}
            {copy.resetSuccessMessage ? <p>{copy.resetSuccessMessage}</p> : null}
            {copy.resetRedirectingMessage ? <p>{copy.resetRedirectingMessage}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="v-auth" data-testid="reset-password-invalid">
        <div className="v-auth__panel">
          <div className="v-auth__body v-auth__success">
            <XCircle
              className="mx-auto mb-4 h-12 w-12"
              style={{ color: "var(--v-red, #b52c26)" }}
              aria-hidden="true"
            />
            {copy.resetInvalidHeading ? (
              <h1 className="v-auth__heading">{copy.resetInvalidHeading}</h1>
            ) : null}
            {copy.resetInvalidMessage ? <p>{copy.resetInvalidMessage}</p> : null}
            {copy.resetRequestNewLabel ? (
              <Link
                href="/auth/forgot-password"
                className="v-auth__link-btn"
                data-testid="reset-password-request-new"
              >
                {copy.resetRequestNewLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const showLabel = copy.showPasswordLabel;
  const hideLabel = copy.hidePasswordLabel;

  return (
    <div className="v-auth" data-testid="reset-password-form">
      <div className="v-auth__panel">
        <div className="v-auth__body">
          {copy.resetHeading ? <h1 className="v-auth__heading">{copy.resetHeading}</h1> : null}
          {copy.resetLede ? <p className="v-auth__lede">{copy.resetLede}</p> : null}
          <form className="v-auth__form" onSubmit={handleSubmit}>
            <div className="v-auth__field">
              {copy.resetPasswordLabel ? (
                <label htmlFor="password" className="v-auth__label">
                  {copy.resetPasswordLabel}
                </label>
              ) : null}
              <div className="v-auth__input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="v-auth__input v-auth__input--with-toggle"
                  placeholder={copy.resetPasswordPlaceholder || undefined}
                  data-testid="reset-password-input"
                />
                <button
                  type="button"
                  className="v-auth__toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? hideLabel : showLabel}
                  data-testid="reset-password-toggle"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <div className="v-auth__field">
              {copy.resetConfirmLabel ? (
                <label htmlFor="confirmPassword" className="v-auth__label">
                  {copy.resetConfirmLabel}
                </label>
              ) : null}
              <div className="v-auth__input-wrap">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="v-auth__input v-auth__input--with-toggle"
                  placeholder={copy.resetConfirmPlaceholder || undefined}
                  data-testid="reset-confirm-password-input"
                />
                <button
                  type="button"
                  className="v-auth__toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? hideLabel : showLabel}
                  data-testid="reset-confirm-password-toggle"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {error ? (
              <div className="v-auth__error" role="alert" data-testid="reset-password-error">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isLoading}
              className="v-auth__submit"
              data-testid="reset-password-submit"
            >
              {isLoading ? (
                <LoadingBasketball
                  variant="inline"
                  message={copy.resetSubmitPendingLabel}
                  testId="reset-password-busy"
                />
              ) : (
                copy.resetSubmitLabel
              )}
            </button>
            {copy.backToSignInLabel ? (
              <div className="v-auth__footer">
                <Link href="/auth/signin" data-testid="reset-password-back-link">
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

/**
 * Reset password — copy from Emails & Account CMS.
 */
export default function ResetPasswordClient({ copy }: { copy: VintageAccountPagesCopy }) {
  return (
    <Suspense fallback={<LoadingBasketball message={copy.resetSubmitPendingLabel} />}>
      <ResetPasswordContent copy={copy} />
    </Suspense>
  );
}
