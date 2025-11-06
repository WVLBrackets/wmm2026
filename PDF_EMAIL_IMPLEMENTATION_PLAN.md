# PDF Email Feature Implementation Plan

## Overview
This document outlines the step-by-step plan to complete the PDF emailing functionality for submitted brackets. The feature will allow users to email themselves a PDF copy of their submitted bracket.

## Current State
- ✅ UI implemented in `MyPicksLanding.tsx` with email button and confirmation dialog
- ✅ API route created at `src/app/api/bracket/email-pdf/route.ts`
- ✅ Email service supports attachments (`src/lib/emailService.ts`)
- ✅ Authentication and authorization checks in place
- ✅ Basic PDF generation structure with Puppeteer
- ❌ Dependencies not installed (`puppeteer-core`, `@sparticuz/chromium`)
- ❌ PDF HTML generation is a placeholder (needs full bracket rendering)
- ❌ Temporary "not working" message in dialog (needs to be reverted)

## Implementation Steps

### Phase 1: Install Dependencies & Setup
**Estimated Time: 30 minutes**

1. **Install required packages**
   ```bash
   npm install puppeteer-core @sparticuz/chromium
   ```

2. **Verify installation**
   - Check `package.json` for new dependencies
   - Ensure no build errors

3. **Test local Puppeteer setup** (Windows development)
   - May need to set `PUPPETEER_EXECUTABLE_PATH` environment variable
   - Or install Chrome/Chromium locally
   - Test basic PDF generation in a simple test script

### Phase 2: Study Print Bracket Page Structure
**Estimated Time: 1 hour**

1. **Analyze `src/app/print-bracket/page.tsx`**
   - Document the complete structure
   - Identify all regions rendering logic
   - Document Final Four and Championship rendering
   - Note all styling and layout patterns
   - Document team logo handling
   - Document tie breaker display

2. **Identify key rendering functions**
   - `renderRegionColumns()` - renders each region's bracket
   - `renderFinalFourSection()` - renders Final Four and Championship
   - Team logo and seed display logic
   - Winner selection and highlighting

3. **Document styling patterns**
   - Inline styles used throughout
   - Font sizes, colors, spacing
   - Border and background colors
   - Responsive patterns (if any)

### Phase 3: Create Server-Side HTML Generator
**Estimated Time: 3-4 hours**

1. **Create helper functions in `route.ts`**
   - `renderRegionHTML()` - Convert region bracket to HTML string
   - `renderFinalFourHTML()` - Convert Final Four/Championship to HTML
   - `renderTeamHTML()` - Convert team display to HTML with logo
   - `getWinnerFromGame()` - Helper to determine game winner

2. **Handle team logos**
   - Convert Next.js `Image` components to `<img>` tags
   - Use absolute URLs for logos (may need to use base64 or public URLs)
   - Consider logo fallback if image fails to load

3. **Recreate styling**
   - Convert all inline styles from React to HTML string format
   - Ensure colors, fonts, spacing match exactly
   - Test visual similarity between print page and PDF

4. **Build complete HTML document**
   - Header with tournament year and entry name
   - Four regions (left-to-right: Top Left, Bottom Left, Top Right, Bottom Right)
   - Final Four and Championship section
   - Tie Breaker display
   - Proper CSS for print/PDF layout

### Phase 4: Test PDF Generation Locally
**Estimated Time: 1-2 hours**

1. **Create test endpoint or script**
   - Test with a real bracket ID
   - Generate PDF and save to disk
   - Verify PDF opens correctly
   - Check formatting matches print-bracket page

2. **Fix any rendering issues**
   - Logo display problems
   - Layout/spacing issues
   - Font or color mismatches
   - Missing or incorrect data

3. **Test edge cases**
   - Bracket with missing picks
   - Different team names (long names, special characters)
   - Missing logos

### Phase 5: Test Email Integration
**Estimated Time: 1 hour**

1. **Test email sending with PDF**
   - Use console email provider first (development)
   - Verify PDF attachment is created correctly
   - Check attachment size (may need optimization)
   - Test with Gmail/SendGrid provider

2. **Verify email content**
   - Subject line is correct
   - HTML email body is formatted well
   - PDF attachment name is descriptive
   - Email is sent to correct user

3. **Test error handling**
   - Invalid bracket ID
   - Unauthorized access
   - PDF generation failure
   - Email sending failure

### Phase 6: Update UI & Polish
**Estimated Time: 30 minutes**

1. **Revert temporary message**
   - Change "This isn't working yet, please cancel." back to:
     - "Would you like to send yourself an email with a PDF of your bracket?"
   - Remove TODO comment

2. **Add loading state**
   - Show spinner while PDF is generating
   - Disable button during process
   - Show success message after email sent

3. **Error handling in UI**
   - Display user-friendly error messages
   - Handle network errors gracefully
   - Log errors for debugging

### Phase 7: Testing & Deployment
**Estimated Time: 1-2 hours**

1. **Test in staging environment**
   - Deploy to staging
   - Test with real submitted bracket
   - Verify PDF quality and email delivery
   - Test on different devices/browsers

2. **Performance testing**
   - Check PDF generation time (should be < 10 seconds)
   - Monitor memory usage
   - Check for timeouts

3. **Fix any production-specific issues**
   - Vercel environment variables
   - Chromium executable path in production
   - Email provider configuration

4. **Deploy to production**
   - Merge to main
   - Monitor for errors
   - Verify email delivery

## Key Technical Considerations

### Puppeteer Configuration
- **Development**: May need local Chrome/Chromium installation
- **Production**: Uses `@sparticuz/chromium` (optimized for Vercel/serverless)
- **Memory**: PDF generation can be memory-intensive for large brackets

### Logo Handling
- **Option 1**: Use absolute URLs (`https://yoursite.com/images/logo.png`)
- **Option 2**: Convert logos to base64 data URIs (larger HTML but more reliable)
- **Option 3**: Use public CDN URLs if logos are hosted elsewhere

### HTML Generation Strategy
- Build HTML string incrementally (region by region)
- Use template literals for clean code
- Consider using a simple HTML templating approach if it gets complex
- Ensure all styles are inline (Puppeteer may not handle external CSS well)

### Team Logo URLs
- Current code uses `/images/team-logos/[team-name].png`
- May need to convert to absolute URLs for PDF generation
- Check if `getTeamInfo()` provides logo URLs that work in PDF context

## Files to Modify

1. **`src/app/api/bracket/email-pdf/route.ts`**
   - Enhance `generatePrintPageHTML()` function
   - Add helper functions for rendering regions, games, teams
   - Handle logo URLs properly

2. **`src/components/MyPicksLanding.tsx`**
   - Revert temporary message
   - Add loading states
   - Improve error handling

3. **`package.json`**
   - Add `puppeteer-core` and `@sparticuz/chromium` dependencies

## Testing Checklist

- [ ] PDF generates successfully for a complete bracket
- [ ] PDF generates successfully for an incomplete bracket (shows partial picks)
- [ ] All four regions render correctly
- [ ] Final Four and Championship render correctly
- [ ] Team logos display in PDF
- [ ] Team names and seeds are correct
- [ ] Tie Breaker value displays correctly
- [ ] Entry name displays in header
- [ ] Tournament year displays correctly
- [ ] Email sends successfully
- [ ] PDF attachment is correct size and format
- [ ] Error handling works for invalid bracket IDs
- [ ] Error handling works for unauthorized access
- [ ] Error handling works for email failures
- [ ] Loading states work correctly in UI
- [ ] Success message displays correctly

## Potential Challenges

1. **Logo Display in PDF**
   - Logos may not load if using relative paths
   - Solution: Convert to absolute URLs or base64

2. **Styling Differences**
   - PDF may render slightly differently than browser
   - Solution: Test and adjust styles as needed

3. **Performance**
   - PDF generation can be slow for complex brackets
   - Solution: Optimize HTML, consider caching if needed

4. **Memory Usage**
   - Large brackets with many logos may use significant memory
   - Solution: Monitor and optimize logo loading

5. **Vercel Function Timeout**
   - PDF generation might exceed function timeout
   - Solution: Optimize code, consider increasing timeout if needed

## Success Criteria

- ✅ User can click "Email PDF" button on submitted bracket
- ✅ Confirmation dialog appears with correct message
- ✅ PDF generates successfully (< 10 seconds)
- ✅ PDF matches the print-bracket page visually
- ✅ Email is sent with PDF attachment
- ✅ PDF opens correctly on recipient's device
- ✅ Error cases are handled gracefully
- ✅ UI provides appropriate feedback

## Estimated Total Time: 8-10 hours

## Notes

- The print-bracket page is a client-side React component, so we're essentially recreating its logic as server-side HTML generation
- Consider creating a shared utility module if bracket rendering logic needs to be reused elsewhere
- May want to add analytics/logging to track PDF generation success rates
- Consider adding a "Download PDF" option in addition to email (future enhancement)

