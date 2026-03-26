'use client';

type BracketEditorTopMessageVariant = 'regional' | 'validation-yellow' | 'validation-green';

interface BracketEditorTopMessageProps {
  message: string;
  variant: BracketEditorTopMessageVariant;
  'data-testid'?: string;
  /** Inside a parent card: no outer rounded box; subtle bar only. */
  embeddedInCard?: boolean;
}

/**
 * Renders optional multi-line copy from site config (`||` = paragraph break) or validation text.
 */
export default function BracketEditorTopMessage({
  message,
  variant,
  'data-testid': testId,
  embeddedInCard = false,
}: BracketEditorTopMessageProps) {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split('||')
    .map((p) => p.trim())
    .filter(Boolean);

  const standaloneBox =
    variant === 'regional'
      ? 'border-2 border-slate-300 bg-slate-50 text-slate-800'
      : variant === 'validation-green'
        ? 'border-2 border-green-400 bg-green-50 text-green-800'
        : 'border-2 border-yellow-400 bg-yellow-50 text-yellow-800';

  const embeddedTone =
    variant === 'regional'
      ? 'border-y border-slate-200 bg-slate-50/90 text-slate-800'
      : variant === 'validation-green'
        ? 'border-y border-green-200 bg-green-50/90 text-green-800'
        : 'border-y border-yellow-200 bg-yellow-50/90 text-yellow-800';

  const embed = embeddedInCard
    ? `rounded-none px-3 py-2 ${embeddedTone}`
    : `rounded-lg px-3 py-3 ${standaloneBox}`;
  const align = embeddedInCard ? 'text-center' : 'text-right';

  return (
    <div data-testid={testId} className={`w-full max-w-full ${embed}`}>
      {parts.map((part, i) => (
        <p key={i} className={`text-sm font-medium ${align} ${i > 0 ? 'mt-2' : ''}`}>
          {part}
        </p>
      ))}
    </div>
  );
}
