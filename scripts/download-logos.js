#!/usr/bin/env node

/**
 * Logo Download Script
 * Downloads team logos from ESPN and stores them locally
 * Run with: node scripts/download-logos.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Common tournament team IDs
const TEAM_IDS = [
  '26', '57', '96', '120', '130', '150', '158', '183', '200', '222',
  '228', '230', '233', '234', '235', '236', '238', '239', '240', '241',
  '242', '243', '244', '245', '246', '247', '248', '249', '250', '251',
  '252', '253', '254', '255', '256', '257', '258', '259', '260', '261'
];

const SIZES = [30, 75];
const ESPN_BASE_URL = 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/';
const LOGOS_DIR = path.join(__dirname, '..', 'public', 'logos');

// Ensure logos directory exists
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

/**
 * Download a single logo
 */
function downloadLogo(teamId, size) {
  return new Promise((resolve, reject) => {
    const url = `${ESPN_BASE_URL}${teamId}.png&h=${size}&w=${size}`;
    const filename = `${teamId}_${size}.png`;
    const filepath = path.join(LOGOS_DIR, filename);
    
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`✅ Logo already exists: ${filename}`);
      resolve();
      return;
    }
    
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`📸 Downloaded: ${filename}`);
          resolve();
        });
      } else {
        console.log(`❌ Failed to download ${filename}: ${response.statusCode}`);
        fs.unlink(filepath, () => {}); // Delete empty file
        resolve(); // Don't reject, just skip
      }
    }).on('error', (err) => {
      console.log(`❌ Error downloading ${filename}:`, err.message);
      fs.unlink(filepath, () => {}); // Delete empty file
      resolve(); // Don't reject, just skip
    });
  });
}

/**
 * Download all logos
 */
async function downloadAllLogos() {
  console.log('🚀 Starting logo download...');
  console.log(`📁 Saving to: ${LOGOS_DIR}`);
  console.log(`📊 Teams: ${TEAM_IDS.length}, Sizes: ${SIZES.length}, Total: ${TEAM_IDS.length * SIZES.length}`);
  
  const downloadPromises = [];
  
  for (const teamId of TEAM_IDS) {
    for (const size of SIZES) {
      downloadPromises.push(downloadLogo(teamId, size));
    }
  }
  
  // Download in batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < downloadPromises.length; i += batchSize) {
    const batch = downloadPromises.slice(i, i + batchSize);
    await Promise.allSettled(batch);
    
    // Small delay between batches
    if (i + batchSize < downloadPromises.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log('✅ Logo download completed!');
  
  // Count downloaded files
  const files = fs.readdirSync(LOGOS_DIR);
  console.log(`📊 Downloaded ${files.length} logo files`);
}

// Run the download
downloadAllLogos().catch(console.error);
