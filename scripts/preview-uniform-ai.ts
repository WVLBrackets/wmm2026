/**
 * Preview uniform design using AI image generation
 * Generates professional-quality sample images to review colors, logos, and overall look
 */

import * as path from 'path';
import { defaultUniformConfig, UniformConfig } from '../src/lib/player-generator/uniform-config';
import { savePlayerImageAI } from '../src/lib/player-generator/ai-player-generator';
import { generatePlayerFilename } from '../src/lib/player-generator/player-generator';

/**
 * Generate preview images with sample variations using AI
 */
async function generatePreview() {
  const config: UniformConfig = defaultUniformConfig;
  
  // Sample variations to preview - different positions and skin tones
  const sampleVariations = [
    { uniformNumber: 1, position: 'QB' as const, skinTone: 'light' as const, pose: 'throwing' as const },
    { uniformNumber: 23, position: 'RB' as const, skinTone: 'medium' as const },
    { uniformNumber: 88, position: 'WR' as const, skinTone: 'dark' as const, pose: 'catching' as const },
    { uniformNumber: 55, position: 'LB' as const, skinTone: 'medium-dark' as const },
  ];

  const outputDir = path.join(process.cwd(), 'public', 'player-preview-ai');
  
  console.log('🎨 Generating AI uniform preview images...');
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`\n📋 Uniform Configuration:`);
  console.log(`   Jersey Color: ${config.jerseyColor}`);
  console.log(`   Pants Color: ${config.pantsColor}`);
  console.log(`   Helmet Color: ${config.helmetColor}`);
  console.log(`   Accent Color: ${config.accentColor}`);
  console.log(`   Pattern: ${config.jerseyPattern}`);
  console.log(`\n🎯 Generating ${sampleVariations.length} preview images using AI...`);
  console.log(`⏱️  This may take a few minutes (AI generation is slower but produces professional results)...\n`);

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY || process.env.STABILITY_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: AI API key not found!');
    console.error('   Please set one of the following environment variables:');
    console.error('   - OPENAI_API_KEY (for DALL-E)');
    console.error('   - STABILITY_API_KEY (for Stability AI)');
    console.error('\n   You can create a .env.local file with:');
    console.error('   OPENAI_API_KEY=your_key_here');
    process.exit(1);
  }

  const provider = (process.env.AI_IMAGE_PROVIDER as 'openai' | 'stability') || 'openai';
  console.log(`🤖 Using provider: ${provider}\n`);

  for (let i = 0; i < sampleVariations.length; i++) {
    const variation = sampleVariations[i];
    const filename = generatePlayerFilename(variation, 'preview-ai');
    const outputPath = path.join(outputDir, filename);
    
    try {
      console.log(`[${i + 1}/${sampleVariations.length}] Generating ${variation.position} #${variation.uniformNumber} (${variation.skinTone})...`);
      await savePlayerImageAI(config, variation, outputPath, {
        width: 1024,
        height: 1024,
        provider: provider as 'openai' | 'stability',
      });
      console.log(`✅ Generated: ${filename}\n`);
    } catch (error) {
      console.error(`❌ Error generating ${filename}:`, error);
      if (error instanceof Error && error.message.includes('API key')) {
        console.error('   Make sure your API key is set correctly in .env.local');
      }
      console.log('');
    }
  }

  console.log(`\n✨ Preview generation complete!`);
  console.log(`📂 Check the preview images in: ${outputDir}`);
  console.log(`\n💡 Review the images and adjust uniform-config.ts if needed.`);
  console.log(`   Once satisfied, you can generate more images using the AI generator.`);
  console.log(`\n⚠️  Note: AI generation costs money per image.`);
  console.log(`   - OpenAI DALL-E 3: ~$0.04-0.08 per image`);
  console.log(`   - Stability AI: ~$0.01-0.02 per image`);
}

// Run if executed directly
if (require.main === module) {
  generatePreview().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generatePreview };

