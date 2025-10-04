const fs = require('fs');
const path = require('path');
const https = require('https');

// Read the team mappings
const teamMappingsPath = path.join(__dirname, '../public/data/team-mappings.json');
const teamMappings = JSON.parse(fs.readFileSync(teamMappingsPath, 'utf8'));

// Create logos directory if it doesn't exist
const logosDir = path.join(__dirname, '../public/logos/teams');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

/**
 * Download a single logo from ESPN
 */
function downloadLogo(teamId, teamName, outputPath) {
  return new Promise((resolve, reject) => {
    // ESPN logo URL format: https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/{teamId}.png
    const logoUrl = `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${teamId}.png`;
    
    console.log(`📥 Downloading ${teamName} (${teamId}) from: ${logoUrl}`);
    
    const file = fs.createWriteStream(outputPath);
    
    https.get(logoUrl, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded ${teamName} (${teamId})`);
          resolve();
        });
      } else {
        console.log(`❌ Failed to download ${teamName} (${teamId}): HTTP ${response.statusCode}`);
        fs.unlink(outputPath, () => {}); // Delete the empty file
        resolve(); // Continue with other downloads
      }
    }).on('error', (err) => {
      console.log(`❌ Error downloading ${teamName} (${teamId}): ${err.message}`);
      fs.unlink(outputPath, () => {}); // Delete the empty file
      resolve(); // Continue with other downloads
    });
  });
}

/**
 * Download all team logos with rate limiting
 */
async function downloadAllLogos() {
  const teams = Object.entries(teamMappings);
  const totalTeams = teams.length;
  let downloaded = 0;
  let failed = 0;
  
  console.log(`🚀 Starting download of ${totalTeams} team logos...`);
  console.log(`📁 Output directory: ${logosDir}`);
  
  // Process teams in batches to avoid overwhelming ESPN's servers
  const batchSize = 5;
  const delay = 1000; // 1 second delay between batches
  
  for (let i = 0; i < teams.length; i += batchSize) {
    const batch = teams.slice(i, i + batchSize);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(teams.length / batchSize)}`);
    
    const promises = batch.map(async ([abbr, teamData]) => {
      const outputPath = path.join(logosDir, `${teamData.id}.png`);
      
      // Skip if file already exists
      if (fs.existsSync(outputPath)) {
        console.log(`⏭️  Skipping ${teamData.name} (${teamData.id}) - already exists`);
        downloaded++;
        return;
      }
      
      try {
        await downloadLogo(teamData.id, teamData.name, outputPath);
        downloaded++;
      } catch (error) {
        console.log(`❌ Failed to download ${teamData.name} (${teamData.id}): ${error.message}`);
        failed++;
      }
    });
    
    await Promise.all(promises);
    
    // Add delay between batches
    if (i + batchSize < teams.length) {
      console.log(`⏳ Waiting ${delay}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log(`\n🎉 Download complete!`);
  console.log(`✅ Successfully downloaded: ${downloaded}`);
  console.log(`❌ Failed downloads: ${failed}`);
  console.log(`📊 Total processed: ${downloaded + failed}/${totalTeams}`);
  
  if (failed > 0) {
    console.log(`\n💡 Some logos failed to download. This is normal - some teams may not have logos on ESPN.`);
    console.log(`💡 You can manually check and download missing logos from: https://www.espn.com/mens-college-basketball/teams`);
  }
}

// Run the download
downloadAllLogos().catch(console.error);
