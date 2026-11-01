import LoadingBasketball from "./LoadingBasketball";
import "./feedback.css";

type RouteLoadingShellVariant = "standings" | "scoreboard";

type RouteLoadingShellProps = {
  variant: RouteLoadingShellVariant;
  /** CMS heading; blank hides the title. */
  heading?: string;
  /** CMS loading caption; blank shows the spinner alone. */
  message?: string;
  year?: number;
  testId: string;
};

/**
 * Soft-nav waiting chrome: heading (if CMS provided it) + basketball spinner.
 * Does not mount VintageShell or DEFAULT copy, so toolbar icons cannot be
 * overwritten by editor seeds during `loading.tsx`.
 */
export default function RouteLoadingShell({
  variant,
  heading,
  message,
  year,
  testId,
}: RouteLoadingShellProps) {
  const prefix = variant === "scoreboard" ? "v-scoreboard" : "v-standings";
  const displayYear =
    typeof year === "number" && Number.isFinite(year) ? year : undefined;
  const title = heading?.trim() ?? "";

  return (
    <div className={`${prefix} ${prefix}--loading`} data-testid={testId} aria-busy="true">
      {title || displayYear != null ? (
        <header className={`${prefix}__header`}>
          <div className={`${prefix}__title-block`}>
            {title ? <h1 className={`${prefix}__heading`}>{title}</h1> : null}
          </div>
          {displayYear != null ? (
            <div className={`${prefix}__header-right`}>
              <div className={`${prefix}__year`}>
                <select
                  disabled
                  value={String(displayYear)}
                  aria-label={`Loading ${variant} for ${displayYear}`}
                  data-testid={`${variant}-year-select-loading`}
                >
                  <option value={displayYear}>{displayYear}</option>
                </select>
              </div>
            </div>
          ) : null}
        </header>
      ) : null}
      <LoadingBasketball message={message} variant="page" testId={`${testId}-spinner`} />
    </div>
  );
}
