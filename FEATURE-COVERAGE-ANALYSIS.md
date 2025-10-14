# Feature Coverage Analysis - Warren's March Madness

## Executive Summary

**Total Features Identified:** 52  
**Features with Tests:** 15 (28.8%)  
**Features without Tests:** 37 (71.2%)  
**Current Test Coverage:** 28.8%

**Automated Testing Goal:** 80%+ coverage across critical user paths

---

## Coverage Breakdown by Category

### 1. Page Rendering (6/6 = 100% Coverage) ✅

| Feature | Location | Test Status | Test File |
|---------|----------|-------------|-----------|
| Homepage renders | `src/app/page.tsx` | ✅ TESTED | `smoke.spec.ts` |
| Standings page renders | `src/app/standings/page.tsx` | ✅ TESTED | `smoke.spec.ts` |
| Prizes page renders | `src/app/prizes/page.tsx` | ✅ TESTED | `smoke.spec.ts` |
| Payments page renders | `src/app/payments/page.tsx` | ✅ TESTED | `smoke.spec.ts` |
| Rules page renders | `src/app/rules/page.tsx` | ✅ TESTED | `smoke.spec.ts` |
| Hall of Fame page renders | `src/app/hall-of-fame/page.tsx` | ✅ TESTED | `smoke.spec.ts` |

---

### 2. Navigation (7/7 = 100% Coverage) ✅

| Feature | Location | Test Status | Test File |
|---------|----------|-------------|-----------|
| Main navigation menu | `src/components/DynamicNavigation.tsx` | ✅ TESTED | `navigation.spec.ts` |
| Home navigation link | `src/components/DynamicNavigation.tsx` | ✅ TESTED | `navigation.spec.ts` |
| Standings navigation link | `src/components/DynamicNavigation.tsx` | ✅ TESTED | `navigation.spec.ts` |
| Rules navigation link | `src/components/DynamicNavigation.tsx` | ✅ TESTED | `navigation.spec.ts` |
| Payments navigation link | `src/components/DynamicNavigation.tsx` | ✅ TESTED | `navigation.spec.ts` |
| Prizes navigation link | `src/components/DynamicNavigation.tsx` | ✅ TESTED | `navigation.spec.ts` |
| Hall of Fame navigation link | `src/components/DynamicNavigation.tsx` | ✅ TESTED | `navigation.spec.ts` |

---

### 3. Standings Features (2/12 = 16.7% Coverage) ⚠️

| Feature | Location | Test Status | Priority | Test File |
|---------|----------|-------------|----------|-----------|
| Standings table display | `src/components/StandingsTable.tsx:494` | ✅ TESTED | HIGH | `smoke.spec.ts` |
| Player search functionality | `src/components/StandingsTable.tsx:477` | ⚠️ PARTIAL | HIGH | `standings.spec.ts` (timeout) |
| Day selector dropdown | `src/components/StandingsTable.tsx:454` | ❌ NOT TESTED | HIGH | - |
| Rank display (1st/2nd/3rd icons) | `src/components/StandingsTable.tsx:334` | ❌ NOT TESTED | MEDIUM | - |
| Points back calculation | `src/components/StandingsTable.tsx:176` | ❌ NOT TESTED | MEDIUM | - |
| Team logo display | `src/components/StandingsTable.tsx:11` | ❌ NOT TESTED | MEDIUM | - |
| Final Four team picks display | `src/components/StandingsTable.tsx:341` | ❌ NOT TESTED | MEDIUM | - |
| Champion pick display | `src/components/StandingsTable.tsx:390` | ❌ NOT TESTED | MEDIUM | - |
| Tiebreaker value display | `src/components/StandingsTable.tsx:409` | ❌ NOT TESTED | LOW | - |
| Paid status indicator | `src/components/StandingsTable.tsx:554` | ❌ NOT TESTED | MEDIUM | - |
| Last updated timestamp | `src/components/StandingsTable.tsx:589` | ❌ NOT TESTED | LOW | - |
| Player count display | `src/components/StandingsTable.tsx:596` | ❌ NOT TESTED | LOW | - |

---

### 4. Homepage Features (0/3 = 0% Coverage) ❌

| Feature | Location | Test Status | Priority |
|---------|----------|-------------|----------|
| Countdown clock display | `src/components/CountdownClock.tsx:96` | ❌ NOT TESTED | HIGH |
| Countdown clock timer updates | `src/components/CountdownClock.tsx:76` | ❌ NOT TESTED | MEDIUM |
| Announcements display | `src/components/Announcements.tsx:112` | ❌ NOT TESTED | HIGH |

---

### 5. Prizes Page Features (0/5 = 0% Coverage) ❌

| Feature | Location | Test Status | Priority |
|---------|----------|-------------|----------|
| Prize pool calculation | `src/app/prizes/page.tsx:45` | ❌ NOT TESTED | HIGH |
| 1st place prize display | `src/app/prizes/page.tsx:106` | ❌ NOT TESTED | HIGH |
| 2nd place prize display | `src/app/prizes/page.tsx:121` | ❌ NOT TESTED | HIGH |
| 3rd place prize display | `src/app/prizes/page.tsx:136` | ❌ NOT TESTED | HIGH |
| Active/Forecast status toggle | `src/app/prizes/page.tsx:59` | ❌ NOT TESTED | MEDIUM |

---

### 6. Rules Page Features (0/4 = 0% Coverage) ❌

| Feature | Location | Test Status | Priority |
|---------|----------|-------------|----------|
| Scoring system display | `src/app/rules/page.tsx:136` | ❌ NOT TESTED | HIGH |
| Tournament deadline formatting | `src/app/rules/page.tsx:45` | ❌ NOT TESTED | MEDIUM |
| Underdog bonus explanation | `src/app/rules/page.tsx:181` | ❌ NOT TESTED | MEDIUM |
| Scoring examples | `src/app/rules/page.tsx:194` | ❌ NOT TESTED | LOW |

---

### 7. Hall of Fame Features (0/6 = 0% Coverage) ❌

| Feature | Location | Test Status | Priority |
|---------|----------|-------------|----------|
| Tournament history timeline | `src/app/hall-of-fame/page.tsx:205` | ❌ NOT TESTED | MEDIUM |
| Reigning champion display | `src/app/hall-of-fame/page.tsx:145` | ❌ NOT TESTED | HIGH |
| Career leaders (top 25) | `src/app/hall-of-fame/page.tsx:337` | ❌ NOT TESTED | MEDIUM |
| Single season leaders | `src/app/hall-of-fame/page.tsx:400` | ❌ NOT TESTED | MEDIUM |
| Tournament statistics | `src/app/hall-of-fame/page.tsx:158` | ❌ NOT TESTED | LOW |
| Team logo display | `src/app/hall-of-fame/page.tsx:4` | ❌ NOT TESTED | LOW |

---

### 8. Navigation Features (0/2 = 0% Coverage) ❌

| Feature | Location | Test Status | Priority |
|---------|----------|-------------|----------|
| Mobile menu toggle | `src/components/DynamicNavigation.tsx:56` | ❌ NOT TESTED | MEDIUM |
| Active page highlighting | `src/components/DynamicNavigation.tsx:121` | ❌ NOT TESTED | LOW |

---

### 9. Data Integration Features (0/7 = 0% Coverage) ❌

| Feature | Location | Test Status | Priority |
|---------|----------|-------------|----------|
| Google Sheets data fetching | `src/lib/googleSheets.ts` | ❌ NOT TESTED | HIGH |
| Standings data loading | `src/lib/standingsData.ts` | ❌ NOT TESTED | HIGH |
| Site config loading | `src/config/site.ts` | ❌ NOT TESTED | HIGH |
| Team logo loading | `src/lib/teamLogos.ts` | ❌ NOT TESTED | MEDIUM |
| Team reference data | `src/lib/teamRefData.ts` | ❌ NOT TESTED | MEDIUM |
| Announcements API call | `src/components/Announcements.tsx:17` | ❌ NOT TESTED | MEDIUM |
| Error handling for API failures | Various | ❌ NOT TESTED | HIGH |

---

## Priority Recommendations

### Critical Path Coverage (Must Have - Target 100%)

These are essential user journeys that must be tested:

1. ✅ **Page Loading** - All pages render (100% covered)
2. ✅ **Basic Navigation** - Users can navigate between pages (100% covered)
3. ⚠️ **View Standings** - Users can see current standings (50% covered - needs more)
4. ❌ **Prize Information** - Users can view prize breakdown (0% covered)
5. ❌ **Rules Information** - Users can understand scoring (0% covered)

### High Priority Features (Target 80%)

Features that significantly impact user experience:

1. **Countdown Clock** (Homepage)
   - Test: Clock displays correctly
   - Test: Clock updates in real-time
   - Test: Shows "Tournament Started" after deadline

2. **Announcements** (Homepage)
   - Test: Announcements load from Google Sheets
   - Test: Fallback announcements on error
   - Test: Date formatting

3. **Standings Search** (Currently failing)
   - Fix: Timeout issue in test
   - Test: Search filters results correctly
   - Test: Shows "No players found" message

4. **Day Selector** (Standings)
   - Test: Dropdown shows available days
   - Test: Selecting day updates standings
   - Test: Loading state during day change

5. **Prize Calculations**
   - Test: Total prize pool = players × $5
   - Test: 1st place = 60% of pool
   - Test: 2nd place = 30% of pool
   - Test: 3rd place = 10% of pool

6. **Data Loading & Error States**
   - Test: Google Sheets API success
   - Test: Fallback on API failure
   - Test: Loading indicators shown
   - Test: Error messages displayed

### Medium Priority Features (Target 60%)

1. Team logo rendering with fallbacks
2. Paid status indicator
3. Points back calculation
4. Rank icons (trophy, medals)
5. Mobile responsive navigation
6. Tournament history display

### Low Priority Features (Target 40%)

1. Last updated timestamps
2. Player count display
3. Tiebreaker values
4. Tournament statistics
5. Scoring examples

---

## Test File Expansion Plan

### New Test Files Needed

```
tests/
├── smoke.spec.ts ✅ (exists)
├── navigation.spec.ts ✅ (exists)
├── standings.spec.ts ⚠️ (needs fixes)
├── homepage.spec.ts ❌ (NEW - countdown, announcements)
├── prizes.spec.ts ❌ (NEW - prize calculations)
├── rules.spec.ts ❌ (NEW - scoring display)
├── hall-of-fame.spec.ts ❌ (NEW - history, leaders)
├── data-loading.spec.ts ❌ (NEW - API integration)
├── mobile.spec.ts ❌ (NEW - responsive behavior)
└── accessibility.spec.ts ❌ (NEW - a11y checks)
```

---

## Quantified Coverage Metrics

### Current State
```
Total Testable Features: 52
Features with Full Coverage: 13
Features with Partial Coverage: 2
Features with No Coverage: 37

Coverage by Lines: ~15-20% (estimated)
Coverage by Features: 28.8%
Coverage by Critical Paths: 40%
```

### Target State (80% Coverage Goal)
```
Total Testable Features: 52
Target Features to Test: 42

Breakdown:
- Critical Path: 100% (5/5)
- High Priority: 80% (12/15)
- Medium Priority: 60% (10/17)
- Low Priority: 40% (6/15)

Required New Tests: ~30 additional test scenarios
Estimated Test Files: 10 total (3 exist, 7 new)
```

---

## Implementation Roadmap

### Phase 1: Fix Existing Tests (Week 1)
- ✅ Install Playwright and dependencies
- ✅ Copy test files from testing branch
- 🔄 Fix `standings.spec.ts` timeout issues
- 🔄 Ensure all smoke tests pass consistently

### Phase 2: Critical Path Coverage (Week 2)
- Create `homepage.spec.ts`
  - Countdown clock tests
  - Announcements tests
- Create `prizes.spec.ts`
  - Prize calculation tests
  - Active/Forecast toggle tests
- Expand `standings.spec.ts`
  - Day selector tests
  - Search functionality (fix existing)
  - Team logo rendering

### Phase 3: High Priority Features (Week 3)
- Create `data-loading.spec.ts`
  - API success scenarios
  - Error handling
  - Fallback data
  - Loading states
- Create `rules.spec.ts`
  - Scoring system display
  - Date formatting
  - Examples validation

### Phase 4: Medium Priority Features (Week 4)
- Create `hall-of-fame.spec.ts`
  - Champion display
  - Leaders tables
  - Tournament history
- Create `mobile.spec.ts`
  - Responsive navigation
  - Mobile menu toggle
  - Touch interactions

### Phase 5: Polish & Accessibility (Week 5)
- Create `accessibility.spec.ts`
  - WCAG compliance
  - Keyboard navigation
  - Screen reader support
- Performance testing
- Visual regression testing

---

## Automated Coverage Collection

### Setup Instructions

1. **Install coverage dependencies:**
```bash
npm install --save-dev @playwright/test nyc istanbul-lib-coverage
```

2. **Configure Playwright for coverage:**
```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Add coverage collection
  webServer: {
    command: 'npm run build && npm run start',
    port: 3000,
  },
});
```

3. **Run tests with coverage:**
```bash
npm run test:coverage
```

4. **Generate coverage report:**
```bash
npx nyc report --reporter=html --reporter=text
```

---

## Coverage Metrics Dashboard

| Category | Features | Tested | Coverage % | Target % |
|----------|----------|--------|------------|----------|
| Page Rendering | 6 | 6 | 100% | 100% |
| Navigation | 7 | 7 | 100% | 100% |
| Standings | 12 | 2 | 16.7% | 80% |
| Homepage | 3 | 0 | 0% | 80% |
| Prizes | 5 | 0 | 0% | 80% |
| Rules | 4 | 0 | 0% | 60% |
| Hall of Fame | 6 | 0 | 0% | 60% |
| Data Integration | 7 | 0 | 0% | 80% |
| **TOTAL** | **52** | **15** | **28.8%** | **80%** |

---

## Next Steps

1. ✅ Review this coverage analysis
2. 🔄 Fix failing tests (`standings.spec.ts`)
3. 📝 Create test plans for homepage features
4. 📝 Create test plans for prizes page
5. 🚀 Implement Phase 2 tests
6. 📊 Set up automated coverage reporting
7. 🎯 Track progress toward 80% coverage goal

---

## Notes

- **Test Data:** Currently uses live Google Sheets data. Consider mocking for more reliable tests.
- **Performance:** Some tests may timeout due to data loading. Adjust timeouts or use fixtures.
- **CI/CD:** Ready to integrate with GitHub Actions for automated test runs.
- **Coverage Tool:** Consider using Playwright's built-in coverage or NYC/Istanbul for detailed metrics.
