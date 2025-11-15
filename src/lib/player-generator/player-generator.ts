/**
 * Football player image generator
 * Generates PNG images of generic football players with customizable uniforms
 */

import { createCanvas, loadImage, CanvasRenderingContext2D, Image } from 'canvas';
import { UniformConfig, PlayerVariation } from './uniform-config';
import * as fs from 'fs';
import * as path from 'path';

export interface GenerationOptions {
  width?: number;
  height?: number;
  outputPath?: string;
}

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 600;

/**
 * Get skin tone color based on variation
 */
function getSkinToneColor(skinTone: PlayerVariation['skinTone']): string {
  const tones: Record<PlayerVariation['skinTone'], string> = {
    light: '#fdbcb4',
    'medium-light': '#e0a890',
    medium: '#c68642',
    'medium-dark': '#8d5524',
    dark: '#5d4037',
  };
  return tones[skinTone];
}

/**
 * Check if position is a pass catcher (should have gloves)
 */
function isPassCatcher(position: PlayerVariation['position']): boolean {
  return ['QB', 'WR', 'TE'].includes(position);
}

/**
 * Draw player face with position-specific expression
 */
function drawFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  headRadius: number,
  position: PlayerVariation['position'],
  oversized: boolean
): void {
  const eyeSize = oversized ? headRadius * 0.25 : headRadius * 0.15;
  const eyeY = y + headRadius * 0.3;
  const mouthY = y + headRadius * 0.7;
  
  // Eyes - larger if oversized
  ctx.fillStyle = '#000000';
  
  // Position-specific eye expressions
  if (position === 'QB') {
    // Calm, focused eyes
    ctx.beginPath();
    ctx.arc(x - headRadius * 0.25, eyeY, eyeSize * 0.6, 0, Math.PI * 2);
    ctx.arc(x + headRadius * 0.25, eyeY, eyeSize * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (position === 'WR') {
    // Flashy, excited eyes (larger)
    ctx.beginPath();
    ctx.arc(x - headRadius * 0.25, eyeY, eyeSize * 0.8, 0, Math.PI * 2);
    ctx.arc(x + headRadius * 0.25, eyeY, eyeSize * 0.8, 0, Math.PI * 2);
    ctx.fill();
    // Add sparkle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - headRadius * 0.3, eyeY - eyeSize * 0.2, 2, 2);
    ctx.fillRect(x + headRadius * 0.2, eyeY - eyeSize * 0.2, 2, 2);
  } else {
    // Default eyes
    ctx.beginPath();
    ctx.arc(x - headRadius * 0.25, eyeY, eyeSize * 0.7, 0, Math.PI * 2);
    ctx.arc(x + headRadius * 0.25, eyeY, eyeSize * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Mouth expression
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (position === 'QB') {
    // Calm, straight mouth
    ctx.moveTo(x - headRadius * 0.2, mouthY);
    ctx.lineTo(x + headRadius * 0.2, mouthY);
  } else if (position === 'WR') {
    // Excited smile
    ctx.arc(x, mouthY, headRadius * 0.15, 0, Math.PI);
  } else {
    // Neutral
    ctx.moveTo(x - headRadius * 0.15, mouthY);
    ctx.lineTo(x + headRadius * 0.15, mouthY);
  }
  ctx.stroke();
}

/**
 * Draw a football player figure with oversized features
 */
function drawPlayerFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  skinTone: string,
  position: PlayerVariation['position'],
  build: PlayerVariation['build'] = 'average',
  oversized: boolean = true
): void {
  // Oversized head if enabled
  const headMultiplier = oversized ? 1.4 : 1.0;
  const headRadius = width * 0.12 * headMultiplier;
  const neckWidth = width * 0.15;
  const neckHeight = height * 0.08;
  const torsoWidth = width * 0.4;
  const torsoHeight = height * 0.25;
  const armWidth = width * 0.12;
  const armLength = height * 0.3;
  const legWidth = width * 0.15;
  const legLength = height * 0.35;

  // Build multiplier
  const buildMultiplier = build === 'slim' ? 0.85 : build === 'muscular' ? 1.15 : 1.0;

  // Head (helmet will be drawn separately, but we draw face first)
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.arc(x, y + headRadius, headRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw face with expression
  if (oversized) {
    drawFace(ctx, x, y + headRadius, headRadius, position, oversized);
  }

  // Neck
  ctx.fillStyle = skinTone;
  ctx.fillRect(
    x - (neckWidth * buildMultiplier) / 2,
    y + headRadius * 2,
    neckWidth * buildMultiplier,
    neckHeight
  );

  // Torso (will be covered by jersey)
  const torsoX = x - (torsoWidth * buildMultiplier) / 2;
  const torsoY = y + headRadius * 2 + neckHeight;
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(torsoX, torsoY, torsoWidth * buildMultiplier, torsoHeight);

  // Arms
  const leftArmX = x - (torsoWidth * buildMultiplier) / 2 - armWidth;
  const rightArmX = x + (torsoWidth * buildMultiplier) / 2;
  const armY = torsoY;

  ctx.fillStyle = skinTone;
  ctx.fillRect(leftArmX, armY, armWidth, armLength);
  ctx.fillRect(rightArmX, armY, armWidth, armLength);

  // Legs
  const legY = torsoY + torsoHeight;
  const leftLegX = x - (torsoWidth * buildMultiplier) / 2;
  const rightLegX = x + (torsoWidth * buildMultiplier) / 2 - legWidth;

  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(leftLegX, legY, legWidth, legLength);
  ctx.fillRect(rightLegX, legY, legWidth, legLength);
}

/**
 * Draw helmet with stripe, logo, and ROOR tab
 */
function drawHelmet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  config: UniformConfig,
  logoPath?: string
): void {
  const helmetRadius = width * 0.15;
  const helmetY = y;

  // Helmet base
  ctx.fillStyle = config.helmetColor;
  ctx.beginPath();
  ctx.arc(x, helmetY + helmetRadius, helmetRadius, 0, Math.PI * 2);
  ctx.fill();

  // Gold stripe down middle
  if (config.helmetStripeColor) {
    ctx.strokeStyle = config.helmetStripeColor;
    ctx.lineWidth = config.helmetStripeWidth || 8;
    ctx.beginPath();
    ctx.moveTo(x, helmetY);
    ctx.lineTo(x, helmetY + helmetRadius * 1.8);
    ctx.stroke();
  }

  // Logo on helmet side (right side)
  if (logoPath && config.logoPosition === 'helmet') {
    // Logo would be loaded and drawn here
    // For now, draw a placeholder circle
    ctx.fillStyle = config.accentColor || '#FEB727';
    ctx.beginPath();
    ctx.arc(x + helmetRadius * 0.4, helmetY + helmetRadius, helmetRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ROOR tab above facemask
  if (config.roorTabText) {
    const tabY = helmetY + helmetRadius * 1.4;
    const tabWidth = helmetRadius * 0.8;
    const tabHeight = helmetRadius * 0.2;
    
    // White rubber tab
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - tabWidth / 2, tabY, tabWidth, tabHeight);
    
    // ROOR text with backwards R
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${helmetRadius * 0.15}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw "ROO" normally, then backwards R
    const text = config.roorTabText;
    if (text === 'ROOR') {
      ctx.fillText('ROO', x - tabWidth * 0.1, tabY + tabHeight / 2);
      // Draw backwards R (simplified - just an R mirrored)
      ctx.save();
      ctx.translate(x + tabWidth * 0.15, tabY + tabHeight / 2);
      ctx.scale(-1, 1);
      ctx.fillText('R', 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(text, x, tabY + tabHeight / 2);
    }
  }

  // Helmet face mask
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Vertical bars
  for (let i = -2; i <= 2; i++) {
    const barX = x + i * (helmetRadius * 0.3);
    ctx.moveTo(barX, helmetY + helmetRadius * 0.5);
    ctx.lineTo(barX, helmetY + helmetRadius * 1.3);
  }
  // Horizontal bars
  ctx.moveTo(x - helmetRadius * 0.6, helmetY + helmetRadius * 0.7);
  ctx.lineTo(x + helmetRadius * 0.6, helmetY + helmetRadius * 0.7);
  ctx.moveTo(x - helmetRadius * 0.6, helmetY + helmetRadius * 1.0);
  ctx.lineTo(x + helmetRadius * 0.6, helmetY + helmetRadius * 1.0);
  ctx.stroke();
}

/**
 * Draw jersey with uniform details
 */
function drawJersey(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: UniformConfig,
  number: number,
  variation: PlayerVariation
): void {
  const torsoWidth = width * 0.4;
  const torsoHeight = height * 0.25;
  const jerseyX = x - torsoWidth / 2;
  const jerseyY = y + height * 0.2;

  // Base jersey
  ctx.fillStyle = config.jerseyColor;
  ctx.fillRect(jerseyX, jerseyY, torsoWidth, torsoHeight);

  // Purple collar
  if (config.collarColor) {
    const collarHeight = torsoHeight * 0.15;
    ctx.fillStyle = config.collarColor;
    // V-neck collar
    ctx.beginPath();
    ctx.moveTo(jerseyX, jerseyY);
    ctx.lineTo(x, jerseyY + collarHeight);
    ctx.lineTo(jerseyX + torsoWidth, jerseyY);
    ctx.closePath();
    ctx.fill();
  }

  // Draw sleeves with trim
  const sleeveWidth = width * 0.12;
  const sleeveHeight = torsoHeight * 0.6;
  const leftSleeveX = jerseyX - sleeveWidth;
  const rightSleeveX = jerseyX + torsoWidth;
  const sleeveY = jerseyY + torsoHeight * 0.2;

  ctx.fillStyle = config.jerseyColor;
  ctx.fillRect(leftSleeveX, sleeveY, sleeveWidth, sleeveHeight);
  ctx.fillRect(rightSleeveX, sleeveY, sleeveWidth, sleeveHeight);

  // Purple sleeve trim
  if (config.sleeveTrimColor) {
    const trimWidth = 4;
    ctx.fillStyle = config.sleeveTrimColor;
    // Left sleeve trim
    ctx.fillRect(leftSleeveX, sleeveY, trimWidth, sleeveHeight);
    ctx.fillRect(leftSleeveX + sleeveWidth - trimWidth, sleeveY, trimWidth, sleeveHeight);
    // Right sleeve trim
    ctx.fillRect(rightSleeveX, sleeveY, trimWidth, sleeveHeight);
    ctx.fillRect(rightSleeveX + sleeveWidth - trimWidth, sleeveY, trimWidth, sleeveHeight);
  }

  // Draw sleeve numbers (smaller)
  if (config.sleeveNumberSize) {
    const sleeveNumberY = sleeveY + sleeveHeight / 2;
    drawNumber(ctx, leftSleeveX + sleeveWidth / 2, sleeveNumberY, number, config, true);
    drawNumber(ctx, rightSleeveX + sleeveWidth / 2, sleeveNumberY, number, config, true);
  }

  // Draw main number (front)
  if (config.numberPosition === 'front' || config.numberPosition === 'both') {
    drawNumber(ctx, x, jerseyY + torsoHeight / 2, number, config, false);
  }
}

/**
 * Draw uniform number with gold outline
 */
function drawNumber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  number: number,
  config: UniformConfig,
  isSleeve: boolean = false
): void {
  const numberSize = isSleeve ? (config.sleeveNumberSize || config.numberSize * 0.3) : config.numberSize;
  
  const numberStr = number.toString().padStart(2, '0');
  
  // Draw gold outline first (thicker)
  if (config.numberOutlineColor) {
    ctx.strokeStyle = config.numberOutlineColor;
    ctx.lineWidth = isSleeve ? 2 : 4;
    ctx.font = `bold ${numberSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(numberStr, x, y);
  }
  
  // Draw purple number on top
  ctx.fillStyle = config.numberColor;
  ctx.font = `bold ${numberSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numberStr, x, y);
}

/**
 * Draw pants with gold stripe
 */
function drawPants(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: UniformConfig
): void {
  const legWidth = width * 0.15;
  const legLength = height * 0.35;
  const legY = y + height * 0.45;
  const leftLegX = x - width * 0.2;
  const rightLegX = x + width * 0.05;

  ctx.fillStyle = config.pantsColor;
  ctx.fillRect(leftLegX, legY, legWidth, legLength);
  ctx.fillRect(rightLegX, legY, legWidth, legLength);

  // Gold stripe
  if (config.pantsStyle === 'stripes' && config.pantsStripeColor) {
    ctx.fillStyle = config.pantsStripeColor;
    const stripeWidth = legWidth * 0.25;
    // Left leg stripe
    ctx.fillRect(leftLegX + legWidth / 2 - stripeWidth / 2, legY, stripeWidth, legLength);
    // Right leg stripe
    ctx.fillRect(rightLegX + legWidth / 2 - stripeWidth / 2, legY, stripeWidth, legLength);
  }
}

/**
 * Draw socks
 */
function drawSocks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: UniformConfig
): void {
  const legWidth = width * 0.15;
  const sockHeight = height * 0.08;
  const sockY = y + height * 0.8; // Bottom of legs
  const leftLegX = x - width * 0.2;
  const rightLegX = x + width * 0.05;

  ctx.fillStyle = config.socksColor;
  ctx.fillRect(leftLegX, sockY, legWidth, sockHeight);
  ctx.fillRect(rightLegX, sockY, legWidth, sockHeight);
}

/**
 * Draw cleats
 */
function drawCleats(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: UniformConfig,
  variation: PlayerVariation
): void {
  const legWidth = width * 0.15;
  const cleatHeight = height * 0.05;
  const cleatY = y + height * 0.88;
  const leftLegX = x - width * 0.2;
  const rightLegX = x + width * 0.05;

  // Cleat base
  ctx.fillStyle = config.cleatColor;
  ctx.fillRect(leftLegX, cleatY, legWidth, cleatHeight);
  ctx.fillRect(rightLegX, cleatY, legWidth, cleatHeight);

  // White laces
  if (config.cleatLaceColor) {
    ctx.fillStyle = config.cleatLaceColor;
    const laceY = cleatY + cleatHeight / 2;
    // Draw laces as small rectangles
    for (let i = 0; i < 3; i++) {
      const laceX = leftLegX + legWidth * 0.2 + i * (legWidth * 0.25);
      ctx.fillRect(laceX, laceY - 1, legWidth * 0.15, 2);
      const rightLaceX = rightLegX + legWidth * 0.2 + i * (legWidth * 0.25);
      ctx.fillRect(rightLaceX, laceY - 1, legWidth * 0.15, 2);
    }
  }

  // Optional accent (some players)
  if (config.cleatAccentColor && Math.random() > 0.7) {
    ctx.fillStyle = config.cleatAccentColor;
    // Small accent stripe
    ctx.fillRect(leftLegX + legWidth * 0.1, cleatY, legWidth * 0.1, cleatHeight);
    ctx.fillRect(rightLegX + legWidth * 0.1, cleatY, legWidth * 0.1, cleatHeight);
  }
}

/**
 * Draw gloves (for pass catchers)
 */
function drawGloves(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: UniformConfig,
  position: PlayerVariation['position']
): void {
  if (!isPassCatcher(position) || !config.gloveColor) {
    return;
  }

  const armWidth = width * 0.12;
  const gloveSize = armWidth * 0.6;
  const leftArmX = x - width * 0.2 - armWidth;
  const rightArmX = x + width * 0.2;
  const armY = y + height * 0.35;

  // Gloves
  ctx.fillStyle = config.gloveColor;
  // Left glove
  ctx.beginPath();
  ctx.arc(leftArmX + armWidth / 2, armY + height * 0.25, gloveSize / 2, 0, Math.PI * 2);
  ctx.fill();
  // Right glove
  ctx.beginPath();
  ctx.arc(rightArmX + armWidth / 2, armY + height * 0.25, gloveSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Gold accents
  if (config.gloveAccentColor) {
    ctx.fillStyle = config.gloveAccentColor;
    // Small accent lines
    ctx.fillRect(leftArmX + armWidth / 2 - gloveSize / 4, armY + height * 0.25 - 2, gloveSize / 2, 2);
    ctx.fillRect(rightArmX + armWidth / 2 - gloveSize / 4, armY + height * 0.25 - 2, gloveSize / 2, 2);
  }
}

/**
 * Draw football (NFL style - brown, no white stripes)
 */
function drawFootball(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  pose?: PlayerVariation['pose']
): void {
  if (!pose || (pose !== 'throwing' && pose !== 'catching')) {
    return;
  }

  const footballLength = width * 0.15;
  const footballWidth = footballLength * 0.4;
  const footballX = x + width * 0.15;
  const footballY = y + width * 0.3;

  // Brown football
  ctx.fillStyle = '#8B4513'; // Brown
  ctx.beginPath();
  ctx.ellipse(footballX, footballY, footballLength / 2, footballWidth / 2, Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();

  // Laces (brown, not white)
  ctx.strokeStyle = '#654321'; // Darker brown
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const laceX = footballX - footballLength / 4 + i * (footballLength / 6);
    ctx.moveTo(laceX, footballY - footballWidth / 3);
    ctx.lineTo(laceX, footballY + footballWidth / 3);
  }
  ctx.stroke();
}

/**
 * Generate a single player image
 */
export async function generatePlayerImage(
  config: UniformConfig,
  variation: PlayerVariation,
  options: GenerationOptions = {}
): Promise<Buffer> {
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Transparent background (or white for now)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const startY = height * 0.1;

  // Get skin tone
  const skinTone = getSkinToneColor(variation.skinTone);
  const oversized = config.oversizedFeatures !== false;

  // Draw player figure (base)
  drawPlayerFigure(
    ctx,
    centerX,
    startY,
    width,
    height,
    skinTone,
    variation.position,
    variation.build,
    oversized
  );

  // Draw helmet (with stripe, logo, ROOR tab)
  drawHelmet(ctx, centerX, startY, width, config, config.logoPath);

  // Draw jersey (with purple collar/trim, numbers)
  drawJersey(
    ctx,
    centerX,
    startY,
    width,
    height,
    config,
    variation.uniformNumber,
    variation
  );

  // Draw pants (with gold stripe)
  drawPants(ctx, centerX, startY, width, height, config);

  // Draw socks
  drawSocks(ctx, centerX, startY, width, height, config);

  // Draw cleats
  drawCleats(ctx, centerX, startY, width, height, config, variation);

  // Draw gloves (for pass catchers)
  drawGloves(ctx, centerX, startY, width, height, config, variation.position);

  // Draw football (if applicable)
  drawFootball(ctx, centerX, startY, width, variation.pose);

  // Convert to buffer
  return canvas.toBuffer('image/png');
}

/**
 * Save player image to file
 */
export async function savePlayerImage(
  config: UniformConfig,
  variation: PlayerVariation,
  outputPath: string,
  options: GenerationOptions = {}
): Promise<string> {
  const buffer = await generatePlayerImage(config, variation, options);
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Generate filename for player image
 */
export function generatePlayerFilename(
  variation: PlayerVariation,
  prefix: string = 'player'
): string {
  return `${prefix}-${variation.uniformNumber}-${variation.position}-${variation.skinTone}.png`;
}
