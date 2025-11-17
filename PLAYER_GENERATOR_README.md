# Football Player Image Generator

A system for generating thousands of generic football player images with customizable uniforms.

## Overview

This system allows you to:
1. **Configure uniform details** (colors, logos, patterns, etc.)
2. **Preview the design** with sample images
3. **Generate thousands of variations** automatically with different numbers, positions, and skin tones

## Quick Start

### Step 1: Configure Your Uniform

Edit `src/lib/player-generator/uniform-config.ts` to customize your uniform design:

```typescript
export const defaultUniformConfig: UniformConfig = {
  jerseyColor: '#1a4d8c',        // Main jersey color
  pantsColor: '#ffffff',         // Pants color
  helmetColor: '#1a4d8c',        // Helmet color
  accentColor: '#ff6b35',        // Accent color for numbers/stripes
  jerseyPattern: 'shoulder-stripes', // Pattern style
  numberColor: '#ffffff',         // Number color
  // ... more options
};
```

### Step 2: Preview the Design

Generate sample images to review your uniform design:

```bash
npm run preview-uniform
```

This creates 4 sample images in `public/player-preview/` showing different variations.

### Step 3: Generate All Variations

Once you're satisfied with the design, generate all variations:

```bash
# Generate all images (5,500 variations by default)
npm run generate-players

# Or with options:
npm run generate-players -- --limit 100        # Test with first 100
npm run generate-players -- --width 800        # Custom size
npm run generate-players -- --start 1000       # Resume from index 1000
```

## Configuration Options

### Uniform Colors

- `jerseyColor`: Main jersey color (hex)
- `jerseySecondaryColor`: Secondary jersey color for patterns
- `pantsColor`: Pants color (hex)
- `helmetColor`: Helmet color (hex)
- `accentColor`: Color for numbers, stripes, etc.
- `accentSecondaryColor`: Additional accent color

### Logo Configuration

- `logoPath`: Path to logo image file (optional)
- `logoPosition`: `'chest' | 'shoulder' | 'helmet' | 'none'`
- `logoSize`: Logo size in pixels

### Number Configuration

- `numberColor`: Number color (hex)
- `numberFont`: `'block' | 'sans-serif' | 'serif'`
- `numberSize`: Number size in pixels
- `numberPosition`: `'front' | 'back' | 'both'`

### Pattern Options

- `jerseyPattern`: 
  - `'solid'` - No pattern
  - `'stripes'` - Horizontal stripes
  - `'shoulder-stripes'` - Stripes on shoulders
  - `'sleeve-stripes'` - Stripes on sleeves
  - `'checkered'` - Checkered pattern

- `pantsStyle`:
  - `'solid'` - Solid color
  - `'stripes'` - Vertical stripes
  - `'side-panel'` - Side panel design

### Additional Options

- `teamName`: Optional team name text
- `teamNameColor`: Team name color
- `teamNameSize`: Team name font size
- `jerseyStyle`: `'v-neck' | 'round-neck' | 'collar'`
- `sleeveLength`: `'short' | 'long' | 'sleeveless'`

## Generated Variations

The system generates images with all combinations of:

- **Uniform Numbers**: 0-99 (100 options)
- **Positions**: QB, RB, WR, TE, OL, DL, LB, CB, S, K, P (11 options)
- **Skin Tones**: light, medium-light, medium, medium-dark, dark (5 options)

**Total: 100 × 11 × 5 = 5,500 unique images**

## File Naming

Generated images follow this naming pattern:
```
player-{number}-{position}-{skinTone}.png
```

Example: `player-23-RB-medium.png`

## Output Locations

- **Preview images**: `public/player-preview/`
- **Batch images**: `public/player-images/`

## Advanced Usage

### Custom Configuration File

You can modify `uniform-config.ts` to create multiple uniform sets, or extend the system to load configurations from JSON files.

### Batch Processing Options

```bash
# Limit generation (for testing)
npm run generate-players -- --limit 50

# Resume from specific index
npm run generate-players -- --start 2000

# Custom batch size (images processed per batch)
npm run generate-players -- --batch-size 200

# Custom image dimensions
npm run generate-players -- --width 800 --height 1200

# Custom output directory
npm run generate-players -- --output ./custom-output
```

### Programmatic Usage

You can also use the generator programmatically:

```typescript
import { generatePlayerImage } from '@/lib/player-generator/player-generator';
import { defaultUniformConfig } from '@/lib/player-generator/uniform-config';

const buffer = await generatePlayerImage(
  defaultUniformConfig,
  {
    uniformNumber: 23,
    position: 'RB',
    skinTone: 'medium',
  },
  { width: 400, height: 600 }
);
```

## Troubleshooting

### Canvas Installation Issues

If you encounter issues with the `canvas` package on Windows, you may need to install additional dependencies. The `canvas` package requires native compilation.

### Memory Issues

For very large batches, you may need to:
- Reduce `batchSize` (default: 100)
- Process in smaller chunks using `--start` and `--limit`
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`

### Logo Loading

If using logos, ensure the logo file path is correct and accessible. Logo support is currently basic - you may need to extend the generator for complex logo positioning.

## Future Enhancements

Potential improvements:
- Support for loading logos from URLs
- More pose variations
- Different body builds
- Additional uniform styles
- JSON configuration file support
- Web UI for uniform configuration
- Real-time preview

## Notes

- Images are generated at 400x600 pixels by default
- All images have transparent backgrounds (white fill currently)
- The generator creates simple, stylized player figures
- For more realistic images, consider integrating with AI image generation APIs


