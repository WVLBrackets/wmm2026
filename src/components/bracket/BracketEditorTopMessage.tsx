'use client';

import { splitCmsLines } from '@/lib/cms/lineBreaks';

type BracketEditorTopMessageVariant = 'regional' | 'validation-yellow' | 'validation-green';

interface BracketEditorTopMessageProps {
  message: string;
  variant: BracketEditorTopMessageVariant;
  'data-testid'?: string;
  /** Kept for call-site compatibility; the vintage bar is always embedded. */
  embeddedInCard?: boolean;
}

/**
 * Renders optional multi-line Bracket Editor Messages copy (`||` = paragraph break).
 * Blank message renders nothing.
 */
export default function BracketEditorTopMessage({
  message,
  variant,
  'data-testid': testId,
}: BracketEditorTopMessageProps) {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const parts = splitCmsLines(trimmed);
  const tone = variant === 'validation-green' ? 'be-msg--ready' : 'be-msg--soft';

  return (
    <div data-testid={testId} className={`w-full max-w-full rounded-none border-y px-3 py-2 ${tone}`}>
      {parts.map((part, i) => (
        <p key={i} className={`text-center text-sm font-medium ${i > 0 ? 'mt-2' : ''}`}>
          {part}
        </p>
      ))}
    </div>
  );
}
