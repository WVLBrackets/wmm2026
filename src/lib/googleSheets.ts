// Google Sheets API integration for Hall of Fame data

export interface HallOfFameEntry {
  year: string;
  firstPlace: {
    name: string;
    team: string;
    score: number;
  };
  secondPlace: {
    name: string;
    score: number;
  };
  thirdPlace: {
    name: string;
    score: number;
  };
  totalEntries: number;
}

// Google Sheet ID from your URL: 1qFjvpimsmilkuJT_zOn3IhidkqLpzbX8MRn1cQxjuHw
const GOOGLE_SHEET_ID = "1qFjvpimsmilkuJT_zOn3IhidkqLpzbX8MRn1cQxjuHw";

/** Verbose retry/success logs for Hall of Fame CSV fetch. Default off so `npm run build` stays quiet. */
function shouldLogGoogleSheetsVerbose(): boolean {
  return (
    process.env.GOOGLE_SHEETS_DEBUG === "true" ||
    process.env.GOOGLE_SHEETS_DEBUG === "1"
  );
}

/**
 * Fetch Hall of Fame podium rows from the published Google Sheet CSV.
 * No hardcoded fallback — a failed fetch throws so stale/wrong winners never display.
 */
export const getHallOfFameData = async (): Promise<HallOfFameEntry[]> => {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=0`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (shouldLogGoogleSheetsVerbose()) {
        console.log(
          `Attempting to fetch Google Sheets data (attempt ${attempt}/3)...`,
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(csvUrl, {
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const csvText = await response.text();
      const lines = csvText.split("\n");
      const data: HallOfFameEntry[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields = parseCSVLine(line);

        if (fields.length >= 9 && fields[0] && fields[0] !== "Year") {
          data.push({
            year: fields[0],
            firstPlace: {
              name: fields[1],
              team: fields[3],
              score: parseInt(fields[4], 10) || 0,
            },
            secondPlace: {
              name: fields[5],
              score: parseInt(fields[6], 10) || 0,
            },
            thirdPlace: {
              name: fields[7],
              score: parseInt(fields[8], 10) || 0,
            },
            totalEntries: parseInt(fields[9], 10) || 0,
          });
        }
      }

      if (shouldLogGoogleSheetsVerbose()) {
        console.log("Successfully fetched Google Sheets data");
      }
      return data;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(
    `Hall of Fame Google Sheet unavailable after 3 attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
};

/**
 * Parse a CSV line with quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
