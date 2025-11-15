/**
 * AI-powered football player image generator
 * Uses AI image generation APIs to create professional-quality player illustrations
 */

import { UniformConfig, PlayerVariation } from './uniform-config';
import * as fs from 'fs';
import * as path from 'path';

export interface GenerationOptions {
  width?: number;
  height?: number;
  outputPath?: string;
  apiKey?: string;
  provider?: 'openai' | 'stability' | 'replicate';
}

/**
 * Build a detailed prompt for AI image generation
 */
function buildImagePrompt(
  config: UniformConfig,
  variation: PlayerVariation
): string {
  const skinToneDesc = {
    light: 'light skin tone',
    'medium-light': 'medium-light skin tone',
    medium: 'medium skin tone',
    'medium-dark': 'medium-dark skin tone',
    dark: 'dark skin tone',
  }[variation.skinTone];

  const positionDesc = {
    QB: 'quarterback',
    RB: 'running back',
    WR: 'wide receiver',
    TE: 'tight end',
    OL: 'offensive lineman',
    DL: 'defensive lineman',
    LB: 'linebacker',
    CB: 'cornerback',
    S: 'safety',
    K: 'kicker',
    P: 'punter',
  }[variation.position];

  const expressionDesc = {
    QB: 'calm, focused, confident expression',
    WR: 'energetic, flashy, excited expression with big smile',
    TE: 'determined, strong expression',
    RB: 'powerful, intense expression',
    default: 'athletic, determined expression',
  }[variation.position] || 'athletic, determined expression';

  const poseDesc = variation.pose
    ? {
        throwing: 'throwing a football with proper throwing motion',
        catching: 'catching a football with hands extended',
        running: 'running with football tucked',
        tackling: 'in a defensive tackling stance',
        standing: 'standing in athletic pose',
      }[variation.pose]
    : 'standing in athletic pose, full body visible';

  // Build uniform description
  const uniformParts: string[] = [];

  // Helmet
  uniformParts.push(
    `black football helmet with a ${config.helmetStripeColor || 'gold'} stripe down the center`
  );
  if (config.logoPosition === 'helmet') {
    uniformParts.push('VL logo on the side of the helmet (purple letters with gold outline and gold football)');
  }
  if (config.roorTabText) {
    uniformParts.push(`white rubber tab above facemask with "${config.roorTabText}" text (last R backwards)`);
  }
  uniformParts.push('black facemask');

  // Jersey
  uniformParts.push(
    `${config.jerseyColor === '#000000' ? 'black' : 'colored'} football jersey`
  );
  uniformParts.push(
    `large number "${variation.uniformNumber.toString().padStart(2, '0')}" on front in ${config.numberColor === '#542583' ? 'purple' : config.numberColor} with ${config.numberOutlineColor === '#FEB727' ? 'gold' : config.numberOutlineColor} outline`
  );
  if (config.sleeveNumberSize) {
    uniformParts.push(`smaller number "${variation.uniformNumber.toString().padStart(2, '0')}" on sleeves`);
  }
  if (config.collarColor) {
    uniformParts.push(`${config.collarColor === '#542583' ? 'purple' : config.collarColor} V-neck collar`);
  }
  if (config.sleeveTrimColor) {
    uniformParts.push(`${config.sleeveTrimColor === '#542583' ? 'purple' : config.sleeveTrimColor} trim on sleeves`);
  }
  if (config.logoPosition === 'chest') {
    uniformParts.push('VL logo on upper chest (purple with gold outline)');
  }

  // Pants
  uniformParts.push(
    `${config.pantsColor === '#542583' ? 'purple' : config.pantsColor} football pants`
  );
  if (config.pantsStyle === 'stripes' && config.pantsStripeColor) {
    uniformParts.push(`${config.pantsStripeColor === '#FEB727' ? 'gold' : config.pantsStripeColor} stripe down the side of each leg`);
  }
  uniformParts.push('visible padding on thighs');

  // Socks
  if (config.socksColor) {
    uniformParts.push(`${config.socksColor === '#542583' ? 'purple' : config.socksColor} socks`);
  }

  // Cleats
  uniformParts.push(
    `${config.cleatColor === '#000000' ? 'black' : config.cleatColor} cleats with ${config.cleatLaceColor === '#ffffff' ? 'white' : config.cleatLaceColor} laces`
  );

  // Gloves (for pass catchers)
  if (isPassCatcher(variation.position) && config.gloveColor) {
    uniformParts.push(
      `${config.gloveColor === '#542583' ? 'purple' : config.gloveColor} football gloves with ${config.gloveAccentColor === '#FEB727' ? 'gold' : config.gloveAccentColor} accents`
    );
  }

  // Football
  if (variation.pose === 'throwing' || variation.pose === 'catching') {
    uniformParts.push('brown NFL-style football (no white stripes, just brown with laces)');
  }

  const uniformDesc = uniformParts.join(', ');

  // Build the complete prompt
  const prompt = `A professional stylized illustration of a ${skinToneDesc} ${positionDesc} football player, ${poseDesc}. 
  
The player has an animated, cartoon-style appearance with greatly oversized features - especially a large head and prominent, expressive eyes. The player has a ${expressionDesc}. The style is realistic but exaggerated, with detailed facial features.

The player is wearing: ${uniformDesc}.

The illustration should be high quality, detailed, and professional. The player should be shown from a front or three-quarter view, full body visible. The background should be plain and light-colored (off-white or light gray). 

No NFL logos, no brand logos (Nike, Adidas, etc.), no text except the uniform numbers and ROOR tab. The style should match professional sports illustration with clean lines and vibrant colors.`;

  return prompt;
}

/**
 * Check if position is a pass catcher
 */
function isPassCatcher(position: PlayerVariation['position']): boolean {
  return ['QB', 'WR', 'TE'].includes(position);
}

/**
 * Generate player image using OpenAI DALL-E
 */
async function generateWithOpenAI(
  prompt: string,
  options: GenerationOptions
): Promise<Buffer> {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in options.');
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: options.width && options.height 
        ? `${options.width}x${options.height}` 
        : '1024x1024',
      quality: 'hd',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const imageUrl = data.data[0].url;

  // Download the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error('Failed to download generated image');
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate player image using Stability AI
 */
async function generateWithStability(
  prompt: string,
  options: GenerationOptions
): Promise<Buffer> {
  const apiKey = options.apiKey || process.env.STABILITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Stability AI API key is required. Set STABILITY_API_KEY environment variable or pass apiKey in options.');
  }

  const response = await fetch(
    'https://api.stability.ai/v2beta/stable-image/generate/core',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*',
      },
      body: JSON.stringify({
        prompt: prompt,
        aspect_ratio: options.width && options.height 
          ? `${options.width}:${options.height}`
          : '1:1',
        output_format: 'png',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stability AI API error: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate a single player image using AI
 */
export async function generatePlayerImageAI(
  config: UniformConfig,
  variation: PlayerVariation,
  options: GenerationOptions = {}
): Promise<Buffer> {
  const prompt = buildImagePrompt(config, variation);
  
  const provider = options.provider || (process.env.AI_IMAGE_PROVIDER as 'openai' | 'stability' | 'replicate') || 'openai';

  switch (provider) {
    case 'openai':
      return generateWithOpenAI(prompt, options);
    case 'stability':
      return generateWithStability(prompt, options);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Save AI-generated player image to file
 */
export async function savePlayerImageAI(
  config: UniformConfig,
  variation: PlayerVariation,
  outputPath: string,
  options: GenerationOptions = {}
): Promise<string> {
  const buffer = await generatePlayerImageAI(config, variation, options);
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

