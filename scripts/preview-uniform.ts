/**
 * Preview uniform design before batch generation
 * Generates a sample image to review colors, logos, and overall look
 */

import * as path from 'path';
import { defaultUniformConfig, UniformConfig } from '../src/lib/player-generator/uniform-config';
import { savePlayerImage, generatePlayerFilename } from '../src/lib/player-generator/player-generator';

/**
 * Generate preview images with sample variations
 */
async function generatePreview() {
  const config: UniformConfig = defaultUniformConfig;
  
  // Sample variations to preview - different positions and skin tones
  const sampleVariations = [
    { uniformNumber: 1, position: 'QB' as const, skinTone: 'light' as const, pose: 'throwing' as const },
    { uniformNumber: 23, position: 'RB' as const, skinTone: 'medium' as const },
    { uniformNumber: 88, position: 'WR' as const, skinTone: 'dark' as const, pose: 'catching' as const },
    { uniformNumber: 55, position: 'LB' as const, skinTone: 'medium-dark' as const },
    { uniformNumber: 12, position: 'QB' as const, skinTone: 'medium-light' as const },
    { uniformNumber: 7, position: 'WR' as const, skinTone: 'light' as const },
  ];

  const outputDir = path.join(process.cwd(), 'public', 'player-preview');
  
  console.log('🎨 Generating uniform preview images...');
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`\n📋 Uniform Configuration:`);
  console.log(`   Jersey Color: ${config.jerseyColor}`);
  console.log(`   Pants Color: ${config.pantsColor}`);
  console.log(`   Helmet Color: ${config.helmetColor}`);
  console.log(`   Accent Color: ${config.accentColor}`);
  console.log(`   Pattern: ${config.jerseyPattern}`);
  console.log(`   Number Style: ${config.numberFont}`);
  console.log(`\n🎯 Generating ${sampleVariations.length} preview images...\n`);

  for (const variation of sampleVariations) {
    const filename = generatePlayerFilename(variation, 'preview');
    const outputPath = path.join(outputDir, filename);
    
    try {
      await savePlayerImage(config, variation, outputPath, {
        width: 400,
        height: 600,
      });
      console.log(`✅ Generated: ${filename}`);
    } catch (error) {
      console.error(`❌ Error generating ${filename}:`, error);
    }
  }

  console.log(`\n✨ Preview generation complete!`);
  console.log(`📂 Check the preview images in: ${outputDir}`);
  console.log(`\n💡 Review the images and adjust uniform-config.ts if needed.`);
  console.log(`   Once satisfied, run the batch generator to create all variations.`);
}

// Run if executed directly
if (require.main === module) {
  generatePreview().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generatePreview };

