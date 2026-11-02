import type { Metadata } from 'next';

/**
 * Keep the print tab title minimal so browser print headers don’t show
 * the env-prefixed site name (`[L] …`) when headers are enabled.
 */
export const metadata: Metadata = {
  title: ' ',
};

export default function PrintBracketLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
