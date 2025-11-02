# Team Reference Data - Shared PROD Database Setup

## Overview

Team reference data is now stored in a **shared production database** that is accessed by both staging and production environments. This ensures data consistency and eliminates the need for manual synchronization.

## Environment Variables Required

### For Staging/Preview Environment:
You need to add **ONE new environment variable** in Vercel:

**`POSTGRES_URL_PROD`**
- **Value**: Your production database connection string
- **Purpose**: Allows staging deployments to connect to the production database for team data operations
- **Where to set**: Vercel Dashboard → Your Project → Settings → Environment Variables → Preview/Staging environment

### For Production Environment:
**`POSTGRES_URL_PROD`** (optional)
- If set, it will be used for team data (recommended to match `POSTGRES_URL`)
- If not set, the system will fallback to `POSTGRES_URL` for team data
- **Where to set**: Vercel Dashboard → Your Project → Settings → Environment Variables → Production environment

## How It Works

1. **Development (Local)**:
   - Uses local database (`DATABASE_URL_LOCAL`)
   - Team Data tab is **hidden** (not available)
   - JSON file is used as fallback

2. **Staging/Preview**:
   - Connects to **production database** for team data (`POSTGRES_URL_PROD`)
   - Uses staging database for users/brackets (`POSTGRES_URL`)
   - Team Data tab is **visible** for editing
   - JSON sync is **disabled** (team data managed directly in database)

3. **Production**:
   - Uses production database for team data (`POSTGRES_URL_PROD` or `POSTGRES_URL`)
   - Team Data tab is **visible** for editing
   - JSON sync is **disabled** (team data managed directly in database)

## Workflow

### Editing Team Data:
1. Admin logs into staging or production
2. Navigates to Admin Panel → Team Data tab
3. Makes edits (add/edit/delete teams)
4. Changes are immediately saved to production database
5. Changes are visible in both staging and production

### Exporting to JSON (for Git):
1. Admin clicks "Export JSON" button in Team Data tab
2. Downloads `team-mappings.json` file
3. Manually commits file to git (optional backup)
4. JSON file serves as fallback/reference only

## Database Schema

The `team_reference_data` table structure:
- `key` (VARCHAR(50), PRIMARY KEY) - Team abbreviation
- `id` (VARCHAR(20)) - Team ID
- `name` (VARCHAR(255)) - Team name
- `logo` (VARCHAR(500)) - Logo path
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Note**: No `environment` column - data is shared across environments.

## Security Notes

- Only admin users can access the Team Data tab
- All operations require admin authentication
- Staging has read/write access to production team data (by design)
- Team data is isolated from user/bracket data (uses different connection)

## Troubleshooting

### "POSTGRES_URL_PROD or POSTGRES_URL environment variable is not set"
- Add `POSTGRES_URL_PROD` environment variable in Vercel
- For production, you can also rely on `POSTGRES_URL` as fallback

### Team Data tab not showing
- Check that you're not in development (localhost)
- Verify you're logged in as an admin user

### Can't connect to production database from staging
- Verify `POSTGRES_URL_PROD` is set correctly in staging environment
- Ensure the connection string has proper SSL configuration
- Check database firewall rules allow connections from Vercel

