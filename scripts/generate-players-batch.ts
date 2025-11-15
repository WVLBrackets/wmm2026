/**
 * Batch generator for football player images
 * Generates thousands of player images with all uniform variations
 */

import * as path from 'path';
import { defaultUniformConfig, UniformConfig, generateAllVariations, PlayerVariation } from '../src/lib/player-generator/uniform-config';
import { savePlayerImage, generatePlayerFilename } from '../src/lib/player-generator/player-generator';

interface BatchOptions {
  config?: UniformConfig;
  outputDir?: string;
  limit?: number; // Limit number of images (for testing)
  startIndex?: number; // Start from specific index
  batchSize?: number; // Process in batches
  width?: number;
  height?: number;
}

/**
 * Generate player images in batches
 */
async function generateBatch(options: BatchOptions = {}) {
  const config = options.config || defaultUniformConfig;
  const outputDir = options.outputDir || path.join(process.cwd(), 'public', 'player-images');
  const limit = options.limit;
  const startIndex = options.startIndex || 0;
  const batchSize = options.batchSize || 100;
  const width = options.width || 400;
  const height = options.height || 600;

  // Get all variations
  let variations = generateAllVariations();
  
  // Apply limit if specified
  if (limit) {
    variations = variations.slice(0, limit);
  }
  
  // Apply start index
  variations = variations.slice(startIndex);
  
  const total = variations.length;
  
  console.log('🏈 Football Player Image Batch Generator');
  console.log('========================================\n');
  console.log(`📋 Uniform Configuration:`);
  console.log(`   Jersey Color: ${config.jerseyColor}`);
  console.log(`   Pants Color: ${config.pantsColor}`);
  console.log(`   Helmet Color: ${config.helmetColor}`);
  console.log(`   Accent Color: ${config.accentColor}`);
  console.log(`   Pattern: ${config.jerseyPattern}`);
  console.log(`\n📊 Generation Stats:`);
  console.log(`   Total Variations: ${total}`);
  console.log(`   Output Directory: ${outputDir}`);
  console.log(`   Image Size: ${width}x${height}`);
  console.log(`   Batch Size: ${batchSize}`);
  if (startIndex > 0) {
    console.log(`   Starting from index: ${startIndex}`);
  }
  console.log(`\n🚀 Starting generation...\n`);

  const startTime = Date.now();
  let processed = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < variations.length; i += batchSize) {
    const batch = variations.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(variations.length / batchSize);

    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} images)...`);

    // Process batch in parallel (with concurrency limit)
    const batchPromises = batch.map(async (variation) => {
      try {
        const filename = generatePlayerFilename(variation, 'player');
        const outputPath = path.join(outputDir, filename);
        await savePlayerImage(config, variation, outputPath, { width, height });
        processed++;
        return { success: true, filename };
      } catch (error) {
        errors++;
        console.error(`   ❌ Error generating ${variation.uniformNumber}-${variation.position}-${variation.skinTone}:`, error);
        return { success: false, error };
      }
    });

    await Promise.all(batchPromises);

    // Progress update
    const progress = ((processed + errors) / total * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = processed / (elapsed as unknown as number);
    const remaining = (total - processed - errors) / rate;
    
    console.log(`   ✅ Batch complete: ${processed} generated, ${errors} errors`);
    console.log(`   📈 Progress: ${progress}% | Elapsed: ${elapsed}s | ETA: ${remaining.toFixed(0)}s\n`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('========================================');
  console.log('✨ Batch generation complete!');
  console.log(`\n📊 Final Stats:`);
  console.log(`   ✅ Successfully generated: ${processed}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   ⏱️  Total time: ${totalTime}s`);
  console.log(`   📁 Output directory: ${outputDir}`);
  console.log(`\n💡 All images saved to: ${outputDir}`);
}

/**
 * Generate with custom configuration
 */
export async function generateWithConfig(
  configPath: string,
  options: Omit<BatchOptions, 'config'> = {}
) {
  // Load custom config
  // For now, user can modify uniform-config.ts directly
  // In the future, we could support loading from JSON
  console.log('📝 Using configuration from uniform-config.ts');
  await generateBatch(options);
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options: BatchOptions = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--start':
        options.startIndex = parseInt(args[++i], 10);
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10);
        break;
      case '--width':
        options.width = parseInt(args[++i], 10);
        break;
      case '--height':
        options.height = parseInt(args[++i], 10);
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--help':
        console.log(`
Football Player Image Batch Generator

Usage:
  tsx scripts/generate-players-batch.ts [options]

Options:
  --limit <number>      Limit number of images to generate (for testing)
  --start <number>      Start from specific index
  --batch-size <number> Number of images to process per batch (default: 100)
  --width <number>      Image width in pixels (default: 400)
  --height <number>     Image height in pixels (default: 600)
  --output <path>       Output directory (default: public/player-images)
  --help                Show this help message

Examples:
  # Generate first 10 images for testing
  tsx scripts/generate-players-batch.ts --limit 10

  # Generate all images starting from index 1000
  tsx scripts/generate-players-batch.ts --start 1000

  # Generate with custom size
  tsx scripts/generate-players-batch.ts --width 800 --height 1200
        `);
        process.exit(0);
    }
  }

  generateBatch(options).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generateBatch };

