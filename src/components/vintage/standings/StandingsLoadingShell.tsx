import RouteLoadingShell from "@/components/vintage/feedback/RouteLoadingShell";
import "./standings.css";

type StandingsLoadingShellProps = {
  /** CMS heading; blank hides the title. */
  heading?: string;
  /** CMS loading caption. */
  message?: string;
  year?: number;
};

/**
 * Instant Standings waiting state. No DEFAULT homepage chrome.
 */
export default function StandingsLoadingShell({
  heading,
  message,
  year,
}: StandingsLoadingShellProps) {
  return (
    <RouteLoadingShell
      variant="standings"
      heading={heading}
      message={message}
      year={year}
      testId="vintage-standings-loading"
    />
  );
}
