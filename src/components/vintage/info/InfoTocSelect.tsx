import {
  parseInfoTocLabelLines,
  type VintageInfoTocItem,
} from "@/lib/vintage/infoContent";

/**
 * Jump chips for handbook sections (mobile + desktop).
 * Labels may use `||` for a two-line break (e.g. Tracker &||Results).
 */
export default function InfoTocSelect({
  heading,
  items,
}: {
  heading: string;
  items: VintageInfoTocItem[];
}) {
  return (
    <nav
      className="v-info-toc-chips-nav"
      aria-label={heading}
      data-testid="vintage-info-toc"
    >
      <span className="v-info-toc-chips-label">{heading}</span>
      <ul className="v-info-toc-chips">
        {items.map((item) => {
          const lines = parseInfoTocLabelLines(item.label);
          return (
            <li key={item.id}>
              <a
                href={`#${item.anchor}`}
                className="v-info-toc-chip"
                data-testid={`vintage-info-toc-chip-${item.anchor}`}
              >
                {lines.map((line, index) => (
                  <span key={`${item.id}-${index}`}>{line}</span>
                ))}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
