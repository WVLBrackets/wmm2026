import RouteLoadingShell from "@/components/vintage/feedback/RouteLoadingShell";
import "./scoreboard.css";

type ScoreboardLoadingShellProps = {
  /** CMS heading; blank hides the title. */
  heading?: string;
  /** CMS loading caption. */
  message?: string;
  year?: number;
};

/**
 * Instant Scoreboard waiting state. No DEFAULT homepage chrome.
 */
export default function ScoreboardLoadingShell({
  heading,
  message,
  year,
}: ScoreboardLoadingShellProps) {
  return (
    <RouteLoadingShell
      variant="scoreboard"
      heading={heading}
      message={message}
      year={year}
      testId="vintage-scoreboard-loading"
    />
  );
}
