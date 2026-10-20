import { NextResponse } from 'next/server';
import { tryLoadTournamentData } from '@/lib/tournamentLoaderServer';
import { getServerSession } from 'next-auth';
import { existsSync } from 'fs';
import { join } from 'path';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';

type IssueSeverity = 'error' | 'warning' | 'info';

interface ValidationIssue {
  severity: IssueSeverity;
  field: string;
  message: string;
}

/**
 * Add a validation issue to the output list.
 */
function pushIssue(
  issues: ValidationIssue[],
  severity: IssueSeverity,
  field: string,
  message: string
) {
  issues.push({ severity, field, message });
}

/**
 * Normalize supported local image references to a filename under public/images.
 * Returns null for values that should be treated as "no image" or external URLs.
 */
function normalizeLocalImageFilename(rawValue?: string): string | null {
  const value = (rawValue || '').trim();

  if (!value || value.toUpperCase() === 'NO') {
    return null;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return null;
  }

  if (value.startsWith('/images/')) {
    return value.slice('/images/'.length);
  }

  if (value.startsWith('/')) {
    return value.slice(1);
  }

  return value;
}

/**
 * Check whether an image file exists under public/images.
 */
function imageExistsInPublic(filename: string): boolean {
  const imagePath = join(process.cwd(), 'public', 'images', filename);
  return existsSync(imagePath);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const config = await getSiteConfigFromGoogleSheetsFresh();

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Failed to load site config from Google Sheets' },
        { status: 500 }
      );
    }

    const issues: ValidationIssue[] = [];

    if (!config.siteName) {
      pushIssue(issues, 'error', 'site_name', 'Missing required field "site_name".');
    }
    if (!config.tournamentYear) {
      pushIssue(issues, 'error', 'tournament_year', 'Missing required field "tournament_year".');
    }
    if (!config.lastYearWinner) {
      pushIssue(issues, 'warning', 'last_year_winner', 'Missing "last_year_winner".');
    }

    const bracketsAvailableRaw = (config.bracketsAvailable || '').trim().toUpperCase();
    if (!bracketsAvailableRaw) {
      pushIssue(
        issues,
        'warning',
        'brackets_available',
        'Missing "brackets_available" (expected YES or NO). Defaulting behavior treats blank as NO.'
      );
    } else if (bracketsAvailableRaw !== 'YES' && bracketsAvailableRaw !== 'NO') {
      pushIssue(
        issues,
        'error',
        'brackets_available',
        `Invalid brackets_available value "${config.bracketsAvailable}". Use YES or NO.`
      );
    }

    if (!config.masterLockMessage?.trim()) {
      pushIssue(
        issues,
        'warning',
        'master_lock_message',
        'Missing "master_lock_message" (shown when Application Master Lock is Locked).'
      );
    }

    if (bracketsAvailableRaw === 'YES') {
      const year = String(config.tournamentYear || '').trim();
      if (year) {
        const tournament = await tryLoadTournamentData(year);
        if (!tournament) {
          pushIssue(
            issues,
            'error',
            'brackets_available',
            `brackets_available is YES but tournament-${year}.json has not been published and has no legacy JSON file.`
          );
        }
      }
      if (!config.bracketsMissingErrorMessage?.trim()) {
        pushIssue(
          issues,
          'warning',
          'brackets_missing_error_message',
          'Missing "brackets_missing_error_message" (used when YES but JSON is absent).'
        );
      }
    } else if (bracketsAvailableRaw === 'NO') {
      if (!config.bracketsNotAvailableMessage?.trim()) {
        pushIssue(
          issues,
          'warning',
          'brackets_not_available_message',
          'Missing "brackets_not_available_message" (may include <date time>).'
        );
      }
      if (!config.bracketsAvailableDateTime?.trim()) {
        pushIssue(
          issues,
          'info',
          'brackets_available_date_time',
          'Missing "brackets_available_date_time" used to fill <date time> in the not-available message.'
        );
      }
    }

    const wmmLogoFilename = normalizeLocalImageFilename(config.wmmLogo);
    if (!wmmLogoFilename) {
      pushIssue(issues, 'warning', 'wmm_logo', 'wmm_logo is not set. Bracket and print logo areas will be empty.');
    } else if (!imageExistsInPublic(wmmLogoFilename)) {
      pushIssue(issues, 'error', 'wmm_logo', `Image file not found: /images/${wmmLogoFilename}`);
    }

    const ctaSlots = [
      { title: config.cta1Title, destination: config.cta1Destination, image: config.cta1Image },
      { title: config.cta2Title, destination: config.cta2Destination, image: config.cta2Image },
      { title: config.cta3Title, destination: config.cta3Destination, image: config.cta3Image },
      { title: config.cta4Title, destination: config.cta4Destination, image: config.cta4Image },
      { title: config.cta5Title, destination: config.cta5Destination, image: config.cta5Image },
      { title: config.cta6Title, destination: config.cta6Destination, image: config.cta6Image },
    ];

    let activeCtaCount = 0;
    for (let index = 0; index < ctaSlots.length; index++) {
      const slot = ctaSlots[index];
      const slotNumber = index + 1;
      const title = (slot.title || '').trim();

      if (title.toUpperCase() === 'NO') {
        pushIssue(
          issues,
          'info',
          `cta${slotNumber}_title`,
          `CTA ${slotNumber} is set to NO, so CTA ${slotNumber + 1}+ will be ignored.`
        );
        break;
      }

      const destination = (slot.destination || '').trim();
      const isCountdown = title.toLowerCase() === 'countdown clock';
      const localImageFilename = normalizeLocalImageFilename(slot.image);
      const hasImage = !!localImageFilename;

      if (!title && !hasImage && !isCountdown) {
        pushIssue(
          issues,
          'warning',
          `cta${slotNumber}_title`,
          `CTA ${slotNumber} has no title and no image. It will not render.`
        );
        continue;
      }

      activeCtaCount++;

      if (!destination) {
        pushIssue(
          issues,
          'warning',
          `cta${slotNumber}_destination`,
          `CTA ${slotNumber} destination is blank. It will default to no link.`
        );
      } else if (destination.toUpperCase() !== 'NO') {
        const isUrl = destination.startsWith('http://') || destination.startsWith('https://');
        const isInternalPath = destination.startsWith('/');
        if (!isUrl && !isInternalPath) {
          pushIssue(
            issues,
            'warning',
            `cta${slotNumber}_destination`,
            `CTA ${slotNumber} destination should start with "/" or "https://".`
          );
        }
      }

      if (isCountdown && destination.toUpperCase() !== 'NO' && destination !== '') {
        pushIssue(
          issues,
          'info',
          `cta${slotNumber}_destination`,
          `CTA ${slotNumber} is a Countdown Clock with a link destination.`
        );
      }

      if (localImageFilename && !imageExistsInPublic(localImageFilename)) {
        pushIssue(
          issues,
          'error',
          `cta${slotNumber}_image`,
          `Image file not found: /images/${localImageFilename}`
        );
      }
    }

    if (activeCtaCount === 0) {
      pushIssue(issues, 'info', 'cta', 'No active CTA cards are configured.');
    }

    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.filter((issue) => issue.severity === 'warning').length;
    const infos = issues.filter((issue) => issue.severity === 'info').length;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          errors,
          warnings,
          infos,
          activeCtaCount,
          checkedAt: new Date().toISOString(),
          isValid: errors === 0,
        },
        issues,
      },
    });
  } catch (error) {
    console.error('Error validating site config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate site config' },
      { status: 500 }
    );
  }
}
