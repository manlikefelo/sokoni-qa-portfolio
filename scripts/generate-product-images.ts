/**
 * Writes one SVG per seeded product into public/products.
 *
 * Product photography is out of scope for this project, but broken images would
 * muddy both the visual-regression baselines and any accessibility pass. These
 * placeholders are generated from the product slug, so they are stable across
 * machines and across runs — a screenshot baseline taken today still matches
 * tomorrow.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PRODUCTS } from '../prisma/seed-data';

const OUT_DIR = join(process.cwd(), 'public', 'products');

const PALETTES: Record<string, { from: string; to: string; ink: string }> = {
  electronics: { from: '#1e3a5f', to: '#2d6a9f', ink: '#dce9f5' },
  'home-kitchen': { from: '#7a4419', to: '#b8753a', ink: '#fbf0e4' },
  fashion: { from: '#4a2b5e', to: '#8b5fa8', ink: '#f5ebfa' },
};

/** Small deterministic hash so each product gets its own arrangement of shapes. */
function hashSlug(slug: string): number {
  let hash = 7;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 100_000;
  }
  return hash;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Breaks the product name onto at most three lines that fit the tile width. */
function wrap(name: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of name.split(' ')) {
    if (current.length === 0) {
      current = word;
    } else if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function buildSvg(name: string, slug: string, category: string): string {
  const palette = PALETTES[category] ?? PALETTES.electronics;
  if (!palette) throw new Error(`No palette for category ${category}`);

  const seed = hashSlug(slug);
  const cx = 200 + (seed % 90) - 45;
  const cy = 150 + ((seed >> 3) % 50) - 25;
  const r = 70 + (seed % 40);
  const rotation = seed % 45;
  const initials = name
    .split(' ')
    .filter((word) => /^[A-Za-z0-9]/.test(word))
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  const lines = wrap(name, 26);
  const textBlock = lines
    .map(
      (line, index) =>
        `    <text x="28" y="${330 + index * 22}" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="${palette.ink}">${escapeXml(line)}</text>`,
    )
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.from}"/>
      <stop offset="100%" stop-color="${palette.to}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g opacity="0.18">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${palette.ink}"/>
    <rect x="${cx - 40}" y="${cy - 40}" width="80" height="80" fill="none" stroke="${palette.ink}" stroke-width="3" transform="rotate(${rotation} ${cx} ${cy})"/>
  </g>
  <text x="200" y="175" text-anchor="middle" font-family="system-ui, sans-serif" font-size="84" font-weight="700" fill="${palette.ink}" opacity="0.55">${escapeXml(initials)}</text>
  <rect x="0" y="290" width="400" height="110" fill="#0b1220" opacity="0.55"/>
${textBlock}
</svg>
`;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const product of PRODUCTS) {
    const svg = buildSvg(product.name, product.slug, product.category);
    writeFileSync(join(OUT_DIR, `${product.slug}.svg`), svg, 'utf8');
  }
  console.log(`Wrote ${PRODUCTS.length} product images to public/products`);
}

main();
