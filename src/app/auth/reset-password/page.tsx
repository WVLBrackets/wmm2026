"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import "@/components/auth/auth.css";

function ResetPasswordContent() {
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
    if (!token) {
      setError("No reset token provided");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/auth/signin");
        }, 3000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch {
      setError("An error occurred. Please try again.");
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
            <h1 className="v-auth__heading">Password Reset Successfully!</h1>
            <p>
              Your password has been updated. You can now sign in with your new
              password.
            </p>
            <p>Redirecting to sign in page...</p>
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
            <h1 className="v-auth__heading">Invalid Reset Link</h1>
            <p>This password reset link is invalid or has expired.</p>
            <Link
              href="/auth/forgot-password"
              className="v-auth__link-btn"
              data-testid="reset-password-request-new"
            >
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v-auth" data-testid="reset-password-form">
      <div className="v-auth__panel">
        <div className="v-auth__body">
          <h1 className="v-auth__heading">Reset your password</h1>
          <p className="v-auth__lede">Enter your new password below</p>

          <form className="v-auth__form" onSubmit={handleSubmit}>
            <div className="v-auth__field">
              <label htmlFor="password" className="v-auth__label">
                New Password
              </label>
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
                  placeholder="Enter your new password"
                  data-testid="reset-password-input"
                />
                <button
                  type="button"
                  className="v-auth__toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
              <label htmlFor="confirmPassword" className="v-auth__label">
                Confirm New Password
              </label>
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
                  placeholder="Confirm your new password"
                  data-testid="reset-confirm-password-input"
                />
                <button
                  type="button"
                  className="v-auth__toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
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

            {error && (
              <div
                className="v-auth__error"
                role="alert"
                data-testid="reset-password-error"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="v-auth__submit"
              data-testid="reset-password-submit"
            >
              {isLoading ? (
                <>
                  <span className="v-auth__spinner" aria-hidden="true" />
                  Resetting password...
                </>
              ) : (
                "Reset Password"
              )}
            </button>

            <div className="v-auth__footer">
              <Link href="/auth/signin" data-testid="reset-password-back-link">
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
