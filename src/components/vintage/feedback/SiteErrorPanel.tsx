import CmsText from '@/components/cms/CmsText';
import './feedback.css';

/**
 * Visitor-facing error panel. Pass CMS copy when the CMS loaded; the
 * CMS-unavailable fallback (no copy to read) lives only in the root error boundary.
 */
export default function SiteErrorPanel({
  title,
  message,
  testId = 'site-error-panel',
  children,
}: {
  /** Blank hides the heading. */
  title?: string;
  /** `||` paragraph breaks supported. Blank hides the body. */
  message?: string;
  testId?: string;
  /** Optional actions (retry / back). */
  children?: React.ReactNode;
}) {
  return (
    <section className="v-site-error" role="alert" data-testid={testId}>
      {title?.trim() ? <h1 className="v-site-error__title">{title}</h1> : null}
      {message?.trim() ? (
        <div className="v-site-error__body">
          <CmsText mode="paragraphs" text={message} />
        </div>
      ) : null}
      {children}
    </section>
  );
}
