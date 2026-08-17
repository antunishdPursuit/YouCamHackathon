/**
 * Generates the shipped placeholder fixtures.
 *
 * These are ORNAMENT, not API output. The panel carries no text of its own — the caption
 * is drawn by the UI beside the frame, so the two cannot say different things. What marks
 * it as a stand-in is `provenance: 'placeholder'`, which the server attaches and the
 * Results screen surfaces.
 *
 * ⚠ Worth knowing: an image with nothing written on it is only labelled while it is inside
 * the app. Screenshot one into a slide deck and the label does not travel with it. That
 * was a deliberate call — the in-image caption duplicated the panel title — but if these
 * ever leave the app on their own, the watermark should come back.
 *
 * The `caption` argument survives because it names the file and titles the SVG, which is
 * what a screen reader and a file listing see.
 *
 * Run with: npm run make-placeholders --workspace @yincol/server
 * `npm run capture-fixtures` overwrites the corresponding real captures alongside them.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_PUBLIC_DIR } from '../src/fixtures/index.js';

const GROUND = '#FFFDF9';
const SURFACE = '#FBF3EA';
const GOLD = '#C6A15B';
const INK = '#4E323B';

/** A 3:4 panel with a gold hairline frame, corner flourishes and a quiet caption. */
function placeholderSvg(caption: string, motif: string): string {
  const width = 600;
  const height = 800;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${caption} — placeholder">
  <title>${caption} — placeholder, not an API result</title>
  <rect width="${width}" height="${height}" fill="${GROUND}"/>
  <rect x="18" y="18" width="${width - 36}" height="${height - 36}" fill="${SURFACE}" rx="20"/>
  <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="${GOLD}" stroke-width="1" rx="14"/>
  <rect x="38" y="38" width="${width - 76}" height="${height - 76}" fill="none" stroke="${GOLD}" stroke-width="0.5" opacity="0.6" rx="10"/>

  <!-- corner flourishes -->
  ${[
    [30, 30, 1, 1],
    [width - 30, 30, -1, 1],
    [30, height - 30, 1, -1],
    [width - 30, height - 30, -1, -1],
  ]
    .map(
      ([x, y, sx, sy]) =>
        `<path d="M ${x} ${(y as number) + (sy as number) * 34} q 0 ${-(sy as number) * 34} ${(sx as number) * 34} ${-(sy as number) * 34}" fill="none" stroke="${GOLD}" stroke-width="1.4"/>` +
        `<circle cx="${(x as number) + (sx as number) * 12}" cy="${(y as number) + (sy as number) * 12}" r="2.4" fill="${GOLD}"/>`,
    )
    .join('\n  ')}

  <!-- centred ornamental motif -->
  <g transform="translate(${width / 2}, ${height / 2 - 40})" opacity="0.85">
    ${motif}
  </g>

  <!-- pearl-dot divider -->
  <g fill="${GOLD}" opacity="0.7">
    ${[-36, -18, 0, 18, 36]
      .map((dx) => `<circle cx="${width / 2 + dx}" cy="${height / 2 + 96}" r="${dx === 0 ? 3.4 : 2.2}"/>`)
      .join('\n    ')}
  </g>

</svg>
`;
}

/** A small mirror-arch motif, in keeping with the vanity-table reference. */
const MIRROR_MOTIF = `
    <path d="M -54 60 L -54 -6 a 54 54 0 0 1 108 0 L 54 60 Z" fill="none" stroke="${GOLD}" stroke-width="1.6"/>
    <path d="M -40 52 L -40 -4 a 40 40 0 0 1 80 0 L 40 52 Z" fill="none" stroke="${GOLD}" stroke-width="0.8" opacity="0.6"/>
    <circle cx="0" cy="-18" r="5" fill="${GOLD}" opacity="0.5"/>`;

/** A compact-lid motif for garment slots. */
const COMPACT_MOTIF = `
    <circle cx="0" cy="16" r="52" fill="none" stroke="${GOLD}" stroke-width="1.6"/>
    <circle cx="0" cy="16" r="40" fill="none" stroke="${GOLD}" stroke-width="0.8" opacity="0.6"/>
    <path d="M -18 16 q 18 -26 36 0 q -18 26 -36 0 Z" fill="none" stroke="${GOLD}" stroke-width="1.2"/>
    <circle cx="0" cy="-46" r="4" fill="${GOLD}" opacity="0.6"/>`;

/** A ribbon motif for the makeup slot. */
const RIBBON_MOTIF = `
    <path d="M 0 20 L -46 -20 q -14 -12 0 -24 q 14 -12 28 4 L 0 12 L 18 -40 q 14 -16 28 -4 q 14 12 0 24 Z" fill="none" stroke="${GOLD}" stroke-width="1.5"/>
    <circle cx="0" cy="20" r="4.5" fill="${GOLD}" opacity="0.6"/>
    <path d="M -10 30 L -22 62 M 10 30 L 22 62" stroke="${GOLD}" stroke-width="1.2" fill="none"/>`;

const PLACEHOLDERS = [
  { file: 'placeholder-portrait.svg', caption: 'Portrait', motif: MIRROR_MOTIF },
  { file: 'placeholder-garment-a.svg', caption: 'Garment A', motif: COMPACT_MOTIF },
  { file: 'placeholder-garment-b.svg', caption: 'Garment B', motif: COMPACT_MOTIF },
  // The complete-look slots get the ribbon, which already marks a kept or finished thing
  // elsewhere in the design, so the two pairs read as different kinds of panel at a
  // glance rather than as four variations of the same one.
  { file: 'placeholder-complete-look-a.svg', caption: 'Complete look A', motif: RIBBON_MOTIF },
  { file: 'placeholder-complete-look-b.svg', caption: 'Complete look B', motif: RIBBON_MOTIF },
];

mkdirSync(FIXTURE_PUBLIC_DIR, { recursive: true });

for (const { file, caption, motif } of PLACEHOLDERS) {
  const target = join(FIXTURE_PUBLIC_DIR, file);
  writeFileSync(target, placeholderSvg(caption, motif), 'utf8');
  console.log(`[yincol] wrote ${file}`);
}

console.log(`[yincol] ${PLACEHOLDERS.length} placeholders written to ${FIXTURE_PUBLIC_DIR}`);
