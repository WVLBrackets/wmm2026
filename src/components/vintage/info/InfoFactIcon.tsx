import {
  customToolbarIconUrl,
  resolveToolbarIcon,
} from "@/lib/vintage/toolbarIcons";

/**
 * Render a Lucide or custom SVG icon for a quick-facts column.
 */
export default function InfoFactIcon({
  name,
  size = 26,
  strokeWidth = 1.6,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = resolveToolbarIcon(name);
  const customSrc = customToolbarIconUrl(name);
  if (Icon) {
    return (
      <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />
    );
  }
  if (customSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="v-info-fact-custom-icon"
        src={customSrc}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
      />
    );
  }
  return null;
}
