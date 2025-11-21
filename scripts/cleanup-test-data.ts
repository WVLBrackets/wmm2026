/**
 * Standalone script to clean up test data from the database
 * 
 * This script can be run locally without deploying:
 *   npx tsx scripts/cleanup-test-data.ts
 * 
 * Or in PowerShell:
 *   npm run cleanup:test-data
 * 
 * REQUIRES: POSTGRES_URL environment variable to be set
 * You can get this from your Vercel project settings
 */

import { sql } from '@vercel/postgres';

/**
 * Get current environment (staging, preview, or production)
 */
function getCurrentEnvironment(): string {
  // Check VERCEL_ENV first (set by Vercel)
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV;
  }
  
  // Check NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  // Default to preview/staging for safety
  return 'preview';
}

async function previewTestData() {
  const environment = getCurrentEnvironment();
  
  console.log(`\n🔍 Previewing test data in environment: ${environment}\n`);
  
  try {
    const result = await sql`
      SELECT id, email, name, email_confirmed, created_at
      FROM users
      WHERE environment = ${environment}
        AND (
          email LIKE 'test-%@example.com'
          OR email LIKE 'testuser-%@example.com'
          OR email LIKE 'test-%@test.com'
        )
      ORDER BY created_at DESC
    `;

    if (result.rows.length === 0) {
      console.log('✅ No test users found.');
      return { count: 0, users: [] };
    }

    console.log(`Found ${result.rows.length} test user(s):\n`);
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Confirmed: ${user.email_confirmed ? 'Yes' : 'No'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });

    return { count: result.rows.length, users: result.rows };
  } catch (error) {
    console.error('❌ Error previewing test data:', error);
    throw error;
  }
}

async function cleanupTestData(confirm: boolean = false) {
  const environment = getCurrentEnvironment();
  
  if (!confirm) {
    console.log('\n⚠️  This will DELETE test users. Use --confirm flag to proceed.\n');
    const preview = await previewTestData();
    console.log(`\nTo delete these ${preview.count} user(s), run:`);
    console.log('  npm run cleanup:test-data -- --confirm\n');
    return;
  }

  console.log(`\n🧹 Cleaning up test data in environment: ${environment}\n`);

  try {
    // First preview what will be deleted
    const preview = await previewTestData();
    
    if (preview.count === 0) {
      console.log('✅ No test users to delete.');
      return;
    }

    // Delete test users (cascade will delete tokens, brackets, etc.)
    const result = await sql`
      DELETE FROM users
      WHERE environment = ${environment}
        AND (
          email LIKE 'test-%@example.com'
          OR email LIKE 'testuser-%@example.com'
          OR email LIKE 'test-%@test.com'
        )
      RETURNING id, email
    `;

    const deletedCount = result.rows.length;
    const deletedEmails = result.rows.map(row => row.email);

    console.log(`\n✅ Successfully deleted ${deletedCount} test user(s):\n`);
    deletedEmails.forEach((email, index) => {
      console.log(`  ${index + 1}. ${email}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    throw error;
  }
}

// Main execution
async function main() {
  // Check for required environment variable
  if (!process.env.POSTGRES_URL) {
    console.error('\n❌ Error: POSTGRES_URL environment variable is required.\n');
    console.log('To get your database connection string:');
    console.log('1. Go to your Vercel project dashboard');
    console.log('2. Navigate to Settings > Environment Variables');
    console.log('3. Find POSTGRES_URL and copy its value');
    console.log('\nThen set it in PowerShell:');
    console.log('  $env:POSTGRES_URL="your-connection-string-here"');
    console.log('  npm run cleanup:test-data\n');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm') || args.includes('-c');

  try {
    if (confirm) {
      await cleanupTestData(true);
    } else {
      await cleanupTestData(false);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();

