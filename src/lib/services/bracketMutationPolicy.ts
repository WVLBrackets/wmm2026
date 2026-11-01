import type { SiteConfigData } from '@/lib/siteConfig';
import type { VintageActionKind } from '@/lib/services/vintageActionLock';
import { evaluateVintageActionLockFresh } from '@/lib/services/vintageActionLockServer';
import { getSiteConfigCached } from '@/lib/siteConfigServer';
import type { VintageBracketEditorContent } from '@/lib/vintage/bracketEditorContent';
import { getPublishedCmsBundle } from '@/lib/vintage/cmsBundle';
import { applyHomepageKeyDataToPicks } from '@/lib/vintage/seasonKeyData';

export type BracketMutationDenial = {
  allowed: false;
  status: number;
  error: string;
  reasonCode?: string;
};

export type BracketMutationAllowance = {
  allowed: true;
  activeYear: number;
  siteConfig: SiteConfigData;
  editorCopy: VintageBracketEditorContent;
};

export type BracketMutationDecision =
  | BracketMutationDenial
  | BracketMutationAllowance;

/**
 * Decide whether a create/update/delete mutation is allowed for a bracket year.
 * All users use vintage Action Lock (My Picks CMS + homepage tipoff/year).
 *
 * @param bracketYear - Year stamped on the bracket (DB). For creates, pass any
 *   hint; with `forCreate: true` always evaluates against Active Tourney Year.
 * @param action - `changing` (default) or `save_wip` (in-progress persist)
 * @param options.forCreate - When true, evaluates against CMS active year
 */
export async function evaluateBracketMutationAccess(
  bracketYear: number,
  action: VintageActionKind = 'changing',
  options?: { forCreate?: boolean },
): Promise<BracketMutationDecision> {
  const bundle = await getPublishedCmsBundle();
  const home = bundle.home;
  const picksCopy = applyHomepageKeyDataToPicks(home, bundle.picks);
  const activeYear = parseInt(String(home.tournament.year).trim(), 10);
  if (Number.isNaN(activeYear)) {
    return {
      allowed: false,
      status: 500,
      error: 'Active Tourney Year is not configured on the homepage.',
      reasonCode: 'brackets_missing_json',
    };
  }
  const yearForLock = options?.forCreate ? activeYear : bracketYear;
  const lock = await evaluateVintageActionLockFresh({
    action,
    bracketYear: yearForLock,
    home,
    picksCopy,
  });
  if (lock.blocked) {
    return {
      allowed: false,
      status: 403,
      error: lock.message,
      reasonCode: lock.reasonCode,
    };
  }
  return {
    allowed: true,
    activeYear: lock.activeYear,
    siteConfig: await getSiteConfigCached(),
    editorCopy: bundle.bracketEditor,
  };
}
