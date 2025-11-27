# Automated Testing Plan

## Overview

This document outlines how to set up automated testing with three different test suites and alerting.

## Test Suite Definitions

### 1. Full Regression Test (Major Builds)
**When:** Triggered on major builds (production deployments, version releases)
**What:** All tests across all browsers
**Command:** `npm test` (runs all ~85+ tests)

### 2. Smoke Test (Any Deployment)
**When:** Triggered on every deployment (preview and production)
**What:** Critical path tests only
**Command:** `npm run test:smoke` (subset of critical tests)

### 3. Health Test (Scheduled)
**When:** Runs on a schedule (e.g., daily, hourly)
**What:** Basic health checks
**Command:** `npm run test:health` (minimal critical tests)

## Implementation Options

### Option 1: GitHub Actions (Recommended)
- ✅ Free for public repos, free tier for private
- ✅ Full control over triggers and notifications
- ✅ Easy to set up different test suites
- ✅ Integrates with GitHub PRs and deployments

### Option 2: Vercel Deployment Checks
- ✅ Built into Vercel
- ✅ Runs automatically on deployments
- ⚠️ Limited customization
- ⚠️ May have time limits

### Option 3: External CI/CD Service
- ✅ More features (e.g., CircleCI, GitHub Actions)
- ⚠️ Additional setup required

## Recommended: GitHub Actions

We'll set up GitHub Actions workflows for:
1. **Full Regression** - On production deployments
2. **Smoke Tests** - On every deployment (preview + production)
3. **Health Checks** - Scheduled (daily/hourly)

## Alerting Options

### Email Alerts
- GitHub Actions can send email on failure
- Vercel can send deployment notifications

### Slack Integration
- GitHub Actions Slack app
- Vercel Slack integration

### GitHub Notifications
- PR comments on test results
- Issue creation on failures

## Next Steps

1. Create test suite definitions in `package.json`
2. Create GitHub Actions workflows
3. Set up alerting (email/Slack)
4. Configure Vercel deployment checks (optional)

