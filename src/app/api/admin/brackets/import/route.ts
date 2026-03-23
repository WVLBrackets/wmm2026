import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import { validateTrustedOrigin } from '@/lib/requestSecurity';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import { getAllTeamReferenceData } from '@/lib/repositories/teamDataRepository';
import { ensureImportUserByEmail } from '@/lib/repositories/userRepository';
import { normalizeStoredDisplayName } from '@/lib/stringNormalize';

interface ParsedImportRow {
  rowNumber: number;
  originalBracketId: string;
  originalUuid: string;
  status: string;
  source: string;
  entryName: string;
  playerName: string;
  playerEmail: string;
  updatedTimestamp: string;
  submittedTimestamp: string;
  tieBreakerRaw: string;
  picks: Record<string, string>;
  updatedAt: Date;
  createdAt: Date;
  /** Stored in `brackets.submitted_at`; null unless status is `submitted`. */
  submittedAtForColumn: Date | null;
}

interface RowFailure {
  rowNumber: number;
  bracketId: string;
  uuid: string;
  reason: string;
}

/**
 * Ensure required bracket columns for import exist in legacy databases.
 */
async function ensureBracketImportColumns(): Promise<void> {
  await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS is_key BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS lock_user_id VARCHAR(36)`;
  await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS lock_acquired_at TIMESTAMPTZ`;
  await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS source VARCHAR(50)`;
  await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`;
  await sql`UPDATE brackets SET source = 'site' WHERE source IS NULL OR source = ''`;
  await sql`
    UPDATE brackets
    SET submitted_at = updated_at
    WHERE status = 'submitted' AND submitted_at IS NULL
  `;
  await sql`ALTER TABLE brackets ALTER COLUMN source SET DEFAULT 'site'`;
  await sql`ALTER TABLE brackets ALTER COLUMN source SET NOT NULL`;
}

/**
 * Resolve the next available bracket number for a year/environment.
 */
async function getNextBracketNumber(year: number, environment: string): Promise<number> {
  const result = await sql`
    SELECT COALESCE(MAX(bracket_number), 0) + 1 AS next_number
    FROM brackets
    WHERE year = ${year} AND environment = ${environment}
  `;
  return Number(result.rows[0]?.next_number || 1);
}

/**
 * Check whether a user already has a submitted bracket with the same
 * entry name for the target year.
 */
async function hasExistingEntryNameForUser(
  playerEmail: string,
  entryName: string,
  year: number,
  environment: string
): Promise<boolean> {
  const result = await sql`
    SELECT b.id
    FROM brackets b
    INNER JOIN users u ON u.id = b.user_id
    WHERE LOWER(u.email) = LOWER(${playerEmail})
      AND LOWER(b.entry_name) = LOWER(${entryName})
      AND b.year = ${year}
      AND b.environment = ${environment}
      AND u.environment = ${environment}
      AND b.status = 'submitted'
      AND COALESCE(b.is_key, FALSE) = FALSE
    LIMIT 1
  `;
  return result.rows.length > 0;
}

/**
 * Parse one CSV line, handling quoted values and escaped quotes.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Escape a value for safe CSV output.
 */
function toCsvValue(value: string | number): string {
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Normalize incoming status and validate against allowed values.
 */
function normalizeStatus(input: string): 'submitted' | 'in_progress' | 'deleted' | null {
  const value = input.trim().toLowerCase();
  if (value === 'submitted') return 'submitted';
  if (value === 'in_progress' || value === 'in progress') return 'in_progress';
  if (value === 'deleted') return 'deleted';
  return null;
}

/**
 * Parse import timestamp supporting ISO strings and Excel/Sheets serial datetimes.
 * Excel serial epoch is 1899-12-30.
 */
function parseImportTimestamp(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  // Excel/Google Sheets serial datetime (e.g. 46100.3512152778)
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (!Number.isFinite(serial)) return null;
    const excelEpochUtcMs = Date.UTC(1899, 11, 30, 0, 0, 0, 0);
    const millisPerDay = 24 * 60 * 60 * 1000;
    const date = new Date(excelEpochUtcMs + serial * millisPerDay);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Standard date parsing (ISO and other JS-supported date strings)
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Generate expected game IDs in export/import order.
 */
function getBracketGameIdOrder(): {
  round1: string[];
  round2: string[];
  sweet16: string[];
  elite8: string[];
} {
  const regions = ['Top Left', 'Bottom Left', 'Top Right', 'Bottom Right'];
  const round1: string[] = [];
  const round2: string[] = [];
  const sweet16: string[] = [];
  const elite8: string[] = [];

  regions.forEach((region) => {
    for (let i = 1; i <= 8; i += 1) round1.push(`${region}-r64-${i}`);
    for (let i = 1; i <= 4; i += 1) round2.push(`${region}-r32-${i}`);
    for (let i = 1; i <= 2; i += 1) sweet16.push(`${region}-s16-${i}`);
    elite8.push(`${region}-e8-1`);
  });

  return { round1, round2, sweet16, elite8 };
}

/**
 * Build a row-level error report CSV for failed imports.
 */
function buildErrorReportCsv(totalRows: number, successRows: number, failures: RowFailure[]): string {
  const totalFailed = failures.length;
  const header = ['Row Number', 'Bracket ID', 'UUID', 'Error'];
  const rows = failures.map((failure) => [
    toCsvValue(failure.rowNumber),
    toCsvValue(failure.bracketId),
    toCsvValue(failure.uuid),
    toCsvValue(failure.reason),
  ]);
  return [
    `Summary,Total Rows,${toCsvValue(totalRows)}`,
    `Summary,Successful Rows,${toCsvValue(successRows)}`,
    `Summary,Failed Rows,${toCsvValue(totalFailed)}`,
    '',
    header.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');
}

/**
 * POST /api/admin/brackets/import — create brackets from CSV.
 *
 * For each row with `status === 'submitted'`, `brackets.submitted_at` is set from the
 * **Submitted Timestamp** or **Submitted Date** column when non-empty; otherwise it uses
 * the row’s **Updated Timestamp** (same as export round-trip when the submitted cell was blank).
 */
export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) {
    return csrfError;
  }

  const originValidation = validateTrustedOrigin(request);
  if (!originValidation.valid) {
    return NextResponse.json(
      { success: false, error: originValidation.error || 'Untrusted request origin' },
      { status: 403 }
    );
  }

  try {
    await requireAdmin();
    await ensureBracketImportColumns();

    const formData = await request.formData();
    const file = formData.get('file');
    const dryRun = String(formData.get('dryRun') || 'true') === 'true';
    const importYearRaw = String(formData.get('importYear') || '').trim();
    const importYear = Number(importYearRaw);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Missing CSV file upload' },
        { status: 400 }
      );
    }
    if (!Number.isInteger(importYear) || importYear < 2000 || importYear > 9999) {
      return NextResponse.json(
        { success: false, error: 'Import year is required and must be a 4-digit year' },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'CSV file is empty or missing data rows' },
        { status: 400 }
      );
    }

    const header = parseCSVLine(lines[0]);
    const headerIndex = new Map<string, number>();
    header.forEach((name, index) => headerIndex.set(name.trim(), index));

    const hasSubmittedTimeColumn =
      headerIndex.has('Submitted Timestamp') || headerIndex.has('Submitted Date');

    const requiredColumns = [
      'Status',
      'Source',
      'Entry Name',
      'Player Name',
      'Player Email',
      'Updated Timestamp',
      'Tie Breaker',
      'Champion',
    ];

    const missingColumns = requiredColumns.filter((column) => !headerIndex.has(column));
    if (missingColumns.length > 0 || !hasSubmittedTimeColumn) {
      const parts: string[] = [];
      if (missingColumns.length > 0) {
        parts.push(`Missing required CSV columns: ${missingColumns.join(', ')}`);
      }
      if (!hasSubmittedTimeColumn) {
        parts.push('Missing required column: Submitted Timestamp or Submitted Date');
      }
      return NextResponse.json({ success: false, error: parts.join(' ') }, { status: 400 });
    }

    const { round1, round2, sweet16, elite8 } = getBracketGameIdOrder();
    const pickColumns = [
      ...round1.map((_, i) => `R1-${i + 1}`),
      ...round2.map((_, i) => `R2-${i + 1}`),
      ...sweet16.map((_, i) => `S16-${i + 1}`),
      ...elite8.map((_, i) => `E8-${i + 1}`),
      'FF-1',
      'FF-2',
      'Champion',
    ];
    const missingPickColumns = pickColumns.filter((column) => !headerIndex.has(column));
    if (missingPickColumns.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required pick columns: ${missingPickColumns.join(', ')}` },
        { status: 400 }
      );
    }

    const environment = getCurrentEnvironment();
    const teamData = await getAllTeamReferenceData(false);
    const abbrToTeamId = new Map<string, string>();
    Object.entries(teamData).forEach(([abbr, team]) => {
      abbrToTeamId.set(abbr.toLowerCase(), team.id);
    });

    const failures: RowFailure[] = [];
    const parsedRows: ParsedImportRow[] = [];

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
      const rowNumber = lineIndex + 1;
      const fields = parseCSVLine(lines[lineIndex]);

      const getField = (name: string): string => {
        const idx = headerIndex.get(name);
        if (idx === undefined) return '';
        // Strip Excel CSV export text guard (U+200B) / BOM so re-import after export round-trips
        return (fields[idx] ?? '').trim().replace(/^[\u200B\uFEFF]+/g, '');
      };

      const bracketId = getField('Bracket ID');
      const uuid = getField('UUID');
      const statusRaw = getField('Status');
      const source = getField('Source');
      const entryName = normalizeStoredDisplayName(getField('Entry Name'));
      const playerName = getField('Player Name');
      const playerEmail = getField('Player Email');
      const updatedTimestamp = getField('Updated Timestamp');
      /** Maps to DB `submitted_at` for submitted rows (empty cell → use updated time). */
      const submittedTimestamp =
        getField('Submitted Timestamp') || getField('Submitted Date');
      const tieBreakerRaw = getField('Tie Breaker');

      if (!statusRaw || !source || !entryName || !playerEmail || !updatedTimestamp) {
        failures.push({ rowNumber, bracketId, uuid, reason: 'Missing one or more required fields' });
        continue;
      }

      const normalizedStatus = normalizeStatus(statusRaw);
      if (!normalizedStatus) {
        failures.push({ rowNumber, bracketId, uuid, reason: `Invalid status "${statusRaw}"` });
        continue;
      }

      const updatedAt = parseImportTimestamp(updatedTimestamp);
      if (!updatedAt) {
        failures.push({ rowNumber, bracketId, uuid, reason: `Invalid Updated Timestamp "${updatedTimestamp}"` });
        continue;
      }

      const submittedAt = submittedTimestamp ? parseImportTimestamp(submittedTimestamp) : null;
      if (submittedTimestamp && !submittedAt) {
        failures.push({ rowNumber, bracketId, uuid, reason: `Invalid Submitted Timestamp "${submittedTimestamp}"` });
        continue;
      }

      // Build picks map from abbreviation fields.
      const picks: Record<string, string> = {};
      const mapPick = (column: string, gameId: string): string | null => {
        const abbr = getField(column);
        if (!abbr) return null;
        const teamId = abbrToTeamId.get(abbr.toLowerCase());
        if (!teamId) return `Unknown team abbreviation "${abbr}" in ${column}`;
        picks[gameId] = teamId;
        return null;
      };

      const pickErrors: string[] = [];
      round1.forEach((gameId, i) => {
        const maybeError = mapPick(`R1-${i + 1}`, gameId);
        if (maybeError) pickErrors.push(maybeError);
      });
      round2.forEach((gameId, i) => {
        const maybeError = mapPick(`R2-${i + 1}`, gameId);
        if (maybeError) pickErrors.push(maybeError);
      });
      sweet16.forEach((gameId, i) => {
        const maybeError = mapPick(`S16-${i + 1}`, gameId);
        if (maybeError) pickErrors.push(maybeError);
      });
      elite8.forEach((gameId, i) => {
        const maybeError = mapPick(`E8-${i + 1}`, gameId);
        if (maybeError) pickErrors.push(maybeError);
      });
      const ff1Error = mapPick('FF-1', 'final-four-1');
      const ff2Error = mapPick('FF-2', 'final-four-2');
      const champError = mapPick('Champion', 'championship');
      [ff1Error, ff2Error, champError].forEach((err) => {
        if (err) pickErrors.push(err);
      });

      if (pickErrors.length > 0) {
        failures.push({ rowNumber, bracketId, uuid, reason: pickErrors[0] });
        continue;
      }

      parsedRows.push({
        rowNumber,
        originalBracketId: bracketId,
        originalUuid: uuid,
        status: normalizedStatus,
        source,
        entryName,
        playerName,
        playerEmail,
        updatedTimestamp,
        submittedTimestamp,
        tieBreakerRaw,
        picks,
        updatedAt,
        createdAt: submittedAt ?? updatedAt,
        submittedAtForColumn:
          normalizedStatus === 'submitted' ? submittedAt ?? updatedAt : null,
      });
    }

    const uniqueSubmittedEntryNamePerUser = new Set<string>();
    const validRows: ParsedImportRow[] = [];
    for (const row of parsedRows) {
      // Duplicate-name rule only applies to submitted imports.
      if (row.status !== 'submitted') {
        validRows.push(row);
        continue;
      }

      const dedupeKey = `${row.playerEmail.trim().toLowerCase()}|${row.entryName.trim().toLowerCase()}|${importYear}`;
      if (uniqueSubmittedEntryNamePerUser.has(dedupeKey)) {
        failures.push({
          rowNumber: row.rowNumber,
          bracketId: row.originalBracketId,
          uuid: row.originalUuid,
          reason: `Duplicate submitted entry name "${row.entryName}" for user ${row.playerEmail} in import file`,
        });
        continue;
      }
      uniqueSubmittedEntryNamePerUser.add(dedupeKey);

      const duplicateExists = await hasExistingEntryNameForUser(
        row.playerEmail,
        row.entryName,
        importYear,
        environment
      );
      if (duplicateExists) {
        failures.push({
          rowNumber: row.rowNumber,
          bracketId: row.originalBracketId,
          uuid: row.originalUuid,
          reason: `Entry name "${row.entryName}" already exists for ${row.playerEmail} in ${importYear}`,
        });
        continue;
      }

      validRows.push(row);
    }

    let importedRows = 0;
    if (!dryRun) {
      for (const row of validRows) {
        try {
          const user = await ensureImportUserByEmail(row.playerEmail, row.playerName);
          let tieBreaker: number | null = null;
          if (row.tieBreakerRaw !== '') {
            const parsedTieBreaker = Number(row.tieBreakerRaw);
            if (!Number.isFinite(parsedTieBreaker)) {
              failures.push({
                rowNumber: row.rowNumber,
                bracketId: row.originalBracketId,
                uuid: row.originalUuid,
                reason: `Invalid Tie Breaker "${row.tieBreakerRaw}"`,
              });
              continue;
            }
            tieBreaker = parsedTieBreaker;
          }

          let inserted = false;
          let retries = 0;
          while (!inserted && retries < 3) {
            const generatedUuid = crypto.randomUUID();
            const nextBracketNumber = await getNextBracketNumber(importYear, environment);

            try {
              await sql`
                INSERT INTO brackets (
                  id,
                  user_id,
                  entry_name,
                  tie_breaker,
                  picks,
                  status,
                  source,
                  bracket_number,
                  year,
                  environment,
                  is_key,
                  lock_user_id,
                  lock_acquired_at,
                  created_at,
                  updated_at,
                  submitted_at
                )
                VALUES (
                  ${generatedUuid},
                  ${user.id},
                  ${row.entryName},
                  ${tieBreaker},
                  ${JSON.stringify(row.picks)},
                  ${row.status},
                  ${row.source},
                  ${nextBracketNumber},
                  ${importYear},
                  ${environment},
                  FALSE,
                  NULL,
                  NULL,
                  ${row.createdAt.toISOString()},
                  ${row.updatedAt.toISOString()},
                  ${row.submittedAtForColumn}
                )
              `;
              inserted = true;
            } catch (innerError) {
              const maybeCode = (innerError as { code?: string })?.code;
              const maybeMessage = innerError instanceof Error ? innerError.message : '';
              const isUniqueConflict = maybeCode === '23505' || maybeMessage.toLowerCase().includes('duplicate key');
              if (!isUniqueConflict) {
                throw innerError;
              }
              retries += 1;
            }
          }

          if (!inserted) {
            failures.push({
              rowNumber: row.rowNumber,
              bracketId: row.originalBracketId,
              uuid: row.originalUuid,
              reason: 'Failed to generate unique bracket identifier',
            });
            continue;
          }

          importedRows += 1;
        } catch (insertError) {
          failures.push({
            rowNumber: row.rowNumber,
            bracketId: row.originalBracketId,
            uuid: row.originalUuid,
            reason: insertError instanceof Error ? insertError.message : 'Failed to insert row',
          });
        }
      }
    }

    const totalRows = lines.length - 1;
    const failedRows = failures.length;
    const successRows = dryRun ? validRows.length : importedRows;
    const errorReportCsv = failures.length > 0 ? buildErrorReportCsv(totalRows, successRows, failures) : null;

    return NextResponse.json({
      success: true,
      data: {
        dryRun,
        importYear,
        totalRows,
        successRows,
        failedRows,
        failures,
        errorReportCsv,
        errorReportFilename: `brackets-import-errors-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.csv`,
      },
    });
  } catch (error) {
    console.error('Error importing brackets from CSV:', error);
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to import brackets' },
      { status: 500 }
    );
  }
}

