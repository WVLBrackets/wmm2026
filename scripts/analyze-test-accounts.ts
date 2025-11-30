#!/usr/bin/env tsx

/**
 * Script to analyze test accounts created during a test run
 * 
 * This script queries the database to:
 * 1. Find all accounts created during a specific time window
 * 2. Group them by email pattern to identify which tests created them
 * 3. Show timestamps to detect retries or duplicate runs
 * 4. Analyze patterns to understand why more accounts were created than expected
 * 
 * Usage:
 *   PowerShell:
 *     $env:TEST_ENV='production'; npx tsx scripts/analyze-test-accounts.ts [startTime] [endTime]
 *   
 *   Bash:
 *     TEST_ENV=production npx tsx scripts/analyze-test-accounts.ts [startTime] [endTime]
 *   
 *   If no times provided, analyzes accounts from the last 2 hours
 *   Times should be in ISO format: 2024-01-15T10:00:00Z
 * 
 * REQUIRES: POSTGRES_URL environment variable to be set
 * You can get this from your Vercel project settings or use the pull-env script
 */

// Load environment variables from .env.test file explicitly
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.test file explicitly
const envPath = resolve(process.cwd(), '.env.test');
config({ path: envPath });

// Get environment from command line or use default
const environment = process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod' 
  ? 'production' 
  : process.env.TEST_ENV || 'staging';

/**
 * Get current environment (staging, preview, or production)
 */
function getCurrentEnvironment(): string {
  // Check VERCEL_ENV first (set by Vercel or our script)
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  }
  
  // Check TEST_ENV
  if (process.env.TEST_ENV === 'production' || process.env.TEST_ENV === 'prod') {
    return 'production';
  }
  
  // Default to preview/staging for safety
  return 'preview';
}

// Use @vercel/postgres directly (like cleanup script)
// This avoids needing POSTGRES_URL in .env.test
import { sql } from '@vercel/postgres';

const dbEnvironment = getCurrentEnvironment();

interface Account {
  id: string;
  email: string;
  name: string;
  email_confirmed: boolean;
  created_at: string;
  environment: string;
}

async function analyzeTestAccounts(startTime?: string, endTime?: string) {
  try {
    // If no times provided, use last 2 hours
    if (!startTime) {
      const now = new Date();
      endTime = now.toISOString();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      startTime = twoHoursAgo.toISOString();
    }

    console.log(`\n🔍 Analyzing test accounts created between:`);
    console.log(`   Start: ${startTime}`);
    console.log(`   End: ${endTime}`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Database Environment: ${dbEnvironment}\n`);

    // Query accounts created in the time window
    const result = await sql`
      SELECT 
        id,
        email,
        name,
        email_confirmed,
        created_at,
        environment
      FROM users
      WHERE environment = ${dbEnvironment}
        AND created_at >= ${startTime}::timestamp
        AND created_at <= ${endTime}::timestamp
      ORDER BY created_at ASC
    `;

    const accounts: Account[] = result.rows as Account[];
    console.log(`📊 Found ${accounts.length} accounts created in this time window\n`);

    if (accounts.length === 0) {
      console.log('No accounts found. Try adjusting the time window.');
      return;
    }

    // Group accounts by email pattern
    const patterns: Record<string, Account[]> = {
      'happy_path_email_test_chrome': [],
      'happy_path_email_test_firefox': [],
      'happy_path_email_test_webkit': [],
      'happy_path_email_test_mobile_chrome': [],
      'happy_path_email_test_mobile_webkit': [],
      'happy_path_email_test_mobile_webkit_pro': [],
      'test-*@example.com': [],
      'testuser-*@example.com': [],
      'other': []
    };

    accounts.forEach(account => {
      const email = account.email.toLowerCase();
      let categorized = false;

      // Check for config-based emails (these are the happy path test emails)
      if (email.includes('happy') || email.includes('test_chrome') || email.includes('test_firefox') || email.includes('test_webkit')) {
        if (email.includes('mobile_chrome')) {
          patterns['happy_path_email_test_mobile_chrome'].push(account);
          categorized = true;
        } else if (email.includes('mobile_webkit_pro')) {
          patterns['happy_path_email_test_mobile_webkit_pro'].push(account);
          categorized = true;
        } else if (email.includes('mobile_webkit') || email.includes('mobile_safari')) {
          patterns['happy_path_email_test_mobile_webkit'].push(account);
          categorized = true;
        } else if (email.includes('chrome')) {
          patterns['happy_path_email_test_chrome'].push(account);
          categorized = true;
        } else if (email.includes('firefox')) {
          patterns['happy_path_email_test_firefox'].push(account);
          categorized = true;
        } else if (email.includes('webkit')) {
          patterns['happy_path_email_test_webkit'].push(account);
          categorized = true;
        }
      }

      // Check for test-*@example.com pattern
      if (!categorized && email.match(/^test-\d+@example\.com$/)) {
        patterns['test-*@example.com'].push(account);
        categorized = true;
      }

      // Check for testuser-*@example.com pattern
      if (!categorized && email.match(/^testuser-\d+@example\.com$/)) {
        patterns['testuser-*@example.com'].push(account);
        categorized = true;
      }

      // Other patterns
      if (!categorized) {
        patterns['other'].push(account);
      }
    });

    // Display results by pattern
    console.log('📋 Accounts grouped by email pattern:\n');
    
    let totalCategorized = 0;
    for (const [pattern, patternAccounts] of Object.entries(patterns)) {
      if (patternAccounts.length > 0) {
        totalCategorized += patternAccounts.length;
        console.log(`  ${pattern}: ${patternAccounts.length} accounts`);
        
        // Show first few emails as examples
        const examples = patternAccounts.slice(0, 3).map(a => a.email);
        if (examples.length > 0) {
          console.log(`    Examples: ${examples.join(', ')}`);
          if (patternAccounts.length > 3) {
            console.log(`    ... and ${patternAccounts.length - 3} more`);
          }
        }
        
        // Check for duplicates (same email created multiple times - indicates retries)
        const emailCounts: Record<string, number> = {};
        patternAccounts.forEach(a => {
          emailCounts[a.email] = (emailCounts[a.email] || 0) + 1;
        });
        const duplicates = Object.entries(emailCounts).filter(([_, count]) => count > 1);
        if (duplicates.length > 0) {
          console.log(`    ⚠️  WARNING: ${duplicates.length} duplicate emails found (possible retries):`);
          duplicates.forEach(([email, count]) => {
            console.log(`       ${email}: created ${count} times`);
          });
        }
        console.log('');
      }
    }

    // Show uncategorized accounts
    if (patterns['other'].length > 0) {
      console.log(`  Other patterns: ${patterns['other'].length} accounts`);
      const examples = patterns['other'].slice(0, 5).map(a => a.email);
      console.log(`    Examples: ${examples.join(', ')}`);
      if (patterns['other'].length > 5) {
        console.log(`    ... and ${patterns['other'].length - 5} more`);
      }
      console.log('');
    }

    // Time distribution analysis
    console.log('⏰ Time distribution:\n');
    const timeGroups: Record<string, number> = {};
    accounts.forEach(account => {
      const date = new Date(account.created_at);
      const hour = date.toISOString().substring(0, 13) + ':00:00Z';
      timeGroups[hour] = (timeGroups[hour] || 0) + 1;
    });

    const sortedHours = Object.entries(timeGroups).sort();
    sortedHours.forEach(([hour, count]) => {
      console.log(`  ${hour}: ${count} accounts`);
    });

    // Summary
    console.log('\n📊 Summary:');
    console.log(`  Total accounts: ${accounts.length}`);
    console.log(`  Expected range: 66-72 accounts (Group 2: 48 + Group 5: 24)`);
    console.log(`  Difference: ${accounts.length - 72} extra accounts`);
    
    // Calculate expected vs actual
    const expectedHappyPath = 6; // 1 per browser
    const actualHappyPath = 
      patterns['happy_path_email_test_chrome'].length +
      patterns['happy_path_email_test_firefox'].length +
      patterns['happy_path_email_test_webkit'].length +
      patterns['happy_path_email_test_mobile_chrome'].length +
      patterns['happy_path_email_test_mobile_webkit'].length +
      patterns['happy_path_email_test_mobile_webkit_pro'].length;
    
    console.log(`  Happy path emails (expected ~6): ${actualHappyPath}`);
    console.log(`  Other test emails: ${accounts.length - actualHappyPath}`);

    // Check for potential issues
    console.log('\n🔍 Potential Issues:');
    if (accounts.length > 72) {
      console.log(`  ⚠️  More accounts than expected (${accounts.length} vs 66-72)`);
      console.log(`     Possible causes:`);
      console.log(`     - Test retries creating duplicate accounts`);
      console.log(`     - Multiple test runs in the time window`);
      console.log(`     - Tests creating more accounts than expected`);
    }
    
    const totalDuplicates = Object.values(patterns).reduce((sum, patternAccounts) => {
      const emailCounts: Record<string, number> = {};
      patternAccounts.forEach(a => {
        emailCounts[a.email] = (emailCounts[a.email] || 0) + 1;
      });
      return sum + Object.values(emailCounts).filter(count => count > 1).length;
    }, 0);
    
    if (totalDuplicates > 0) {
      console.log(`  ⚠️  Found duplicate emails (retries detected)`);
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error analyzing accounts:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const startTime = process.argv[2];
const endTime = process.argv[3];

// Run analysis
analyzeTestAccounts(startTime, endTime)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

