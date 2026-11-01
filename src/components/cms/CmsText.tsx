import { Fragment, type ElementType, type HTMLAttributes } from "react";
import { splitCmsLines } from "@/lib/cms/lineBreaks";

type CmsTextMode = "breaks" | "paragraphs";

type CmsTextProps = {
  /** CMS string (tokens already resolved). */
  text: string;
  /**
   * `breaks` — one element with `<br />` between lines (default).
   * `paragraphs` — one `<p>` per line (tracker notes, confirm dialogs).
   */
  mode?: CmsTextMode;
  /** Wrapper element for `breaks` mode (default `span`). Ignored for `paragraphs`. */
  as?: ElementType;
  /** Optional class on the wrapper (`breaks`) or each `<p>` (`paragraphs`). */
  className?: string;
  /** Optional test id on the wrapper / first paragraph. */
  "data-testid"?: string;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

/**
 * Render CMS copy with `||` as hard line breaks.
 * Prefer this (or `splitCmsLines`) for every visitor-facing CMS string.
 */
export default function CmsText({
  text,
  mode = "breaks",
  as: Tag = "span",
  className,
  "data-testid": testId,
  ...rest
}: CmsTextProps) {
  const lines = splitCmsLines(text);

  if (mode === "paragraphs") {
    if (!lines.length) return null;
    return (
      <>
        {lines.map((line, index) => (
          <p
            key={`cms-line-${index}`}
            className={className}
            data-testid={index === 0 ? testId : undefined}
          >
            {line}
          </p>
        ))}
      </>
    );
  }

  if (!lines.length) {
    return (
      <Tag className={className} data-testid={testId} {...rest}>
        {""}
      </Tag>
    );
  }

  if (lines.length === 1) {
    return (
      <Tag className={className} data-testid={testId} {...rest}>
        {lines[0]}
      </Tag>
    );
  }

  return (
    <Tag className={className} data-testid={testId} {...rest}>
      {lines.map((line, index) => (
        <Fragment key={`cms-br-${index}`}>
          {index > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </Tag>
  );
}
