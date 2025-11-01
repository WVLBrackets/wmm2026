# ESPN Team Sync Script

This script syncs team data from ESPN by checking team IDs and comparing them with the database.

## Prerequisites

- `POSTGRES_URL_PROD` or `POSTGRES_URL` environment variable must be set
- Node.js and npm installed
- Network access to ESPN and the database

## Usage

### Report Only Mode (No Database Updates)
```bash
npm run sync-teams report [startId] [endId]
```

Examples:
```bash
npm run sync-teams report          # Report for IDs 1-20
npm run sync-teams report 1 20     # Report for IDs 1-20
npm run sync-teams report 1 100    # Report for IDs 1-100
```

### Report and Update Mode
```bash
npm run sync-teams update [startId] [endId]
```

Examples:
```bash
npm run sync-teams update          # Update for IDs 1-20
npm run sync-teams update 1 20     # Update for IDs 1-20
```

## What It Does

1. **For each team ID:**
   - Fetches the ESPN page: `https://www.espn.com/mens-college-basketball/team/_/id/{id}`
   - Extracts the team name from the page
   - Checks if the team exists in the database

2. **If team exists in database:**
   - Compares the database name with ESPN name
   - If they match: Reports as "Match" ✅
   - If they don't match: Appends "ERROR" to the database name (in update mode)

3. **If team doesn't exist in database:**
   - Checks if ESPN page is valid (not 404)
   - If valid: Creates a new team entry with:
     - ID: The team ID
     - Name: Team name from ESPN
     - Abbreviation: Same as ID (as specified)
     - Logo: Empty (can be filled later)

## Output

The script provides:
- Real-time progress for each team ID
- Summary report with:
  - Total processed
  - Matches
  - Mismatches
  - New teams created
  - Teams not found
  - Errors
- Detailed lists of mismatches and new teams
- Time estimate for processing 1-4000 IDs

## Notes

- The script includes a 500ms delay between requests to avoid rate limiting
- Invalid ESPN pages (404s) are skipped
- Teams with name mismatches will have "ERROR" appended to alert administrators
- The script connects directly to the production database (shared between staging and prod)


