import "./feedback.css";

export type LoadingBasketballVariant = "page" | "screen" | "inline" | "plain";

interface LoadingBasketballProps {
  /** CMS-sourced message; blank renders the spinner alone. */
  message?: string;
  variant?: LoadingBasketballVariant;
  className?: string;
  testId?: string;
}

/**
 * Canonical vintage waiting indicator: spinning basketball + optional caption.
 */
export default function LoadingBasketball({
  message,
  variant = "page",
  className,
  testId = "loading-basketball",
}: LoadingBasketballProps) {
  const variantClass = variant === "plain" ? "" : ` v-loading--${variant}`;
  const text = message?.trim();
  return (
    <div
      className={`v-loading${variantClass}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={text || undefined}
      data-testid={testId}
    >
      <div className="v-loading__ball" aria-hidden />
      {text ? <p className="v-loading__text">{text}</p> : null}
    </div>
  );
}
