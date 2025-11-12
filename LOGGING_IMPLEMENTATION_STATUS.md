# Usage Logging Implementation Status

## Completed ✅
- Database tables created (usage_logs, error_logs)
- Logging service utilities (usageLogger.ts, errorLogger.ts)
- API routes for batch logging (/api/log/usage, /api/log/error)
- React hook for page visits (useUsageLogger)
- LoggedButton and LoggedLink wrapper components
- ErrorBoundary component
- Page visit logging for: Home, Info, Standings, Hall of Fame, Pick

## In Progress / To Do 🔄

### Button/Link Integration Needed:
1. **MyPicksLanding.tsx**:
   - ✅ New Bracket button
   - ✅ Logout button
   - ⏳ Edit (from In Progress Bracket)
   - ⏳ Copy (from In Progress Bracket)
   - ⏳ Delete (from In Progress Bracket)
   - ⏳ View (from Submitted Bracket)
   - ⏳ Edit (from Submitted Bracket)
   - ⏳ Print (from Submitted Bracket)
   - ⏳ Email (from Submitted Bracket)

2. **bracket/page.tsx**:
   - ⏳ Sign In button
   - ⏳ Create Account button

3. **RegionBracketLayout.tsx**:
   - ⏳ Save button
   - ⏳ Cancel button
   - ⏳ Submit button (Next button when on final step)

4. **DynamicNavigation.tsx**:
   - ⏳ Contact Us link (if exists)
   - ⏳ Logout link

5. **StandingsTable.tsx**:
   - ⏳ Standings toggle
   - ⏳ Search Players

6. **Auth pages**:
   - ⏳ Forgot Your password link
   - ⏳ Create New Account link
   - ⏳ Create Account button
   - ⏳ Sign In button

### Admin UI:
- ⏳ Create admin page for viewing usage logs
- ⏳ Create admin page for viewing error logs
- ⏳ Add filtering and search capabilities

### Cleanup Job:
- ⏳ Add scheduled cleanup for 60-day retention

## Notes:
- All buttons/links should use LoggedButton or LoggedLink components
- Bracket-specific actions should pass bracketId
- ErrorBoundary should wrap the app in layout.tsx

