import Link from "next/link";
import { Mail } from "lucide-react";
import type { ReactNode } from "react";
import type { VintageContent } from "@/lib/vintage/content";
import { resolveVintageFontStack } from "@/lib/vintage/fonts";
import VintageMasthead from "./VintageMasthead";
import VintageToolbar from "./VintageToolbar";
import "./vintage.css";

/**
 * Shared vintage chrome: theme tokens, toolbar, masthead, and footer.
 * Homepage and Info handbook both render inside this shell.
 */
export default function VintageShell({
  content: c,
  children,
  draft = false,
  draftReturnHref = "/vintage/admin",
  testId = "vintage-page",
}: {
  content: VintageContent;
  children: ReactNode;
  draft?: boolean;
  /** Editor return link shown on unpublished draft banners. */
  draftReturnHref?: string;
  testId?: string;
}) {
  const fonts = c.theme.fonts;
  const themeStyle = {
    ["--v-ink" as string]: c.theme.primary,
    ["--v-red" as string]: c.theme.headline,
    ["--v-paper" as string]: c.theme.background,
    ["--v-first" as string]: c.theme.first,
    ["--v-second" as string]: c.theme.second,
    ["--v-third" as string]: c.theme.third,
    ["--v-font-headline" as string]: resolveVintageFontStack(
      fonts.headline,
      "Alfa Slab One",
    ),
    ["--v-font-icons" as string]: resolveVintageFontStack(fonts.icons, "Oswald"),
    ["--v-font-body" as string]: resolveVintageFontStack(fonts.body, "Arial"),
    ["--v-font-specialty" as string]: resolveVintageFontStack(
      fonts.bodySpecialty,
      "Georgia",
    ),
  };

  return (
    <div className="vintage-page" data-testid={testId} style={themeStyle}>
      {draft && (
        <div className="v-draft-banner">
          UNPUBLISHED DRAFT{" "}
          <Link href={draftReturnHref} data-testid="vintage-return-editor">
            Return to editor →
          </Link>
        </div>
      )}
      <div className="v-paper">
        <header className="v-edition-header" data-testid="vintage-header">
          <VintageToolbar items={c.toolbar} />
          <VintageMasthead
            first={c.masthead.first}
            second={c.masthead.second}
          />
        </header>
        <main className="v-main">{children}</main>
        <footer className="v-footer">
          <span>{c.footer.text}</span>
          {c.footer.contactEmail && (
            <a
              data-testid="vintage-contact"
              href={`mailto:${c.footer.contactEmail}`}
            >
              <Mail size={13} aria-hidden="true" />
              {c.footer.contactLabel.trim() || "A note to the commissioner"}
            </a>
          )}
        </footer>
      </div>
    </div>
  );
}
