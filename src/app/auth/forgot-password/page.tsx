"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { usageLogger } from "@/lib/usageLogger";
import "@/components/auth/auth.css";

/**
 * Password recovery form — vintage panel styling; existing API behavior preserved.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    usageLogger.log("Click", "Send Reset Instructions", null, email);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        setError(data.error || "Failed to send reset email");
      }
    } catch {
      setError("An error occurred. Please try again.");
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
            <h1 className="v-auth__heading">Check your email</h1>
            <p>
              We&apos;ve sent password reset instructions to{" "}
              <strong>{email}</strong>
            </p>
            <Link
              href="/auth/signin"
              className="v-auth__link-btn"
              data-testid="forgot-password-back-signin"
            >
              Back to Sign In
            </Link>
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
              Try another email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v-auth" data-testid="forgot-password-form">
      <div className="v-auth__panel">
        <div className="v-auth__body">
          <h1 className="v-auth__heading">Forgot Password</h1>
          <p className="v-auth__lede">
            Enter your email address and we&apos;ll send you instructions to
            reset your password.
          </p>

          <form className="v-auth__form" onSubmit={handleSubmit}>
            <div className="v-auth__field">
              <label htmlFor="email" className="v-auth__label">
                Email address
              </label>
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
                  placeholder="Enter your email address."
                  data-testid="forgot-password-email-input"
                />
              </div>
            </div>

            {error && (
              <div
                className="v-auth__error"
                role="alert"
                data-testid="forgot-password-error"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="v-auth__submit"
              data-testid="forgot-password-submit"
            >
              {isLoading ? (
                <>
                  <span className="v-auth__spinner" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                "Send Reset Instructions"
              )}
            </button>

            <div className="v-auth__footer">
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-1"
                data-testid="forgot-password-back-link"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
