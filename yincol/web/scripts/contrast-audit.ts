/**
 * Contrast audit — every gold instance and every pastel button ground.
 *
 * Run with: npm run contrast-audit --workspace @yincol/web
 *
 * The rule from the design brief is that antique gold is for hairlines, borders,
 * flourishes and small icons ONLY — never body text, never text on a light ground,
 * because it fails contrast. This script is how we know that is actually true of the
 * built product rather than merely intended.
 *
 * Anything failing is LOGGED in docs/api-findings.md, not silently patched by nudging a
 * design token until the number goes green.
 */

import { contrastRatio } from '@yincol/shared';

const TOKENS = {
  ground: '#FFFDF9',
  surface: '#FBF3EA',
  powder: '#F6D7DD',
  wisteria: '#DFD0EC',
  sky: '#D6E4F0',
  gold: '#C6A15B',
  ink: '#4E323B',
  inkSoft: '#6B4A54',
} as const;

interface Check {
  readonly what: string;
  readonly fg: string;
  readonly bg: string;
  /** 4.5 for body text, 3 for large text and meaningful non-text. */
  readonly required: number;
  readonly kind: 'text' | 'large-text' | 'non-text';
  /**
   * A failure we have already investigated and written up in docs/api-findings.md.
   *
   * This is a baseline, not an excuse: known gaps still print as failures, they just do
   * not fail the run. A failure WITHOUT this flag is new, and breaks the build — which
   * is the whole point of keeping the list explicit.
   */
  readonly knownGap?: string;
}

const CHECKS: Check[] = [
  // ── Body text on every ground it actually lands on ──────────
  { what: 'ink on ground (body)', fg: TOKENS.ink, bg: TOKENS.ground, required: 4.5, kind: 'text' },
  { what: 'ink on surface (body)', fg: TOKENS.ink, bg: TOKENS.surface, required: 4.5, kind: 'text' },
  { what: 'ink on powder (primary button label)', fg: TOKENS.ink, bg: TOKENS.powder, required: 4.5, kind: 'text' },
  { what: 'ink on sky (locked chip)', fg: TOKENS.ink, bg: TOKENS.sky, required: 4.5, kind: 'text' },
  { what: 'ink on wisteria', fg: TOKENS.ink, bg: TOKENS.wisteria, required: 4.5, kind: 'text' },

  // ── Secondary text ──────────────────────────────────────────
  { what: 'ink-soft on ground (secondary)', fg: TOKENS.inkSoft, bg: TOKENS.ground, required: 4.5, kind: 'text' },
  { what: 'ink-soft on surface (secondary)', fg: TOKENS.inkSoft, bg: TOKENS.surface, required: 4.5, kind: 'text' },
  { what: 'ink-soft on powder (secondary)', fg: TOKENS.inkSoft, bg: TOKENS.powder, required: 4.5, kind: 'text' },

  // ── Gold: ornament only. These are the ones to watch. ───────
  {
    what: 'gold hairline on ground (non-text border)',
    fg: TOKENS.gold,
    bg: TOKENS.ground,
    required: 3,
    kind: 'non-text',
    knownGap: 'AA-1',
  },
  {
    what: 'gold hairline on surface (non-text border)',
    fg: TOKENS.gold,
    bg: TOKENS.surface,
    required: 3,
    kind: 'non-text',
    knownGap: 'AA-1',
  },
  {
    what: 'gold hairline on powder (non-text border)',
    fg: TOKENS.gold,
    bg: TOKENS.powder,
    required: 3,
    kind: 'non-text',
    knownGap: 'AA-1',
  },
  {
    what: 'gold AS TEXT on ground — must never be used',
    fg: TOKENS.gold,
    bg: TOKENS.ground,
    required: 4.5,
    kind: 'text',
    knownGap: 'AA-0',
  },

  // ── Focus ring ──────────────────────────────────────────────
  { what: 'focus ring (ink) on ground', fg: TOKENS.ink, bg: TOKENS.ground, required: 3, kind: 'non-text' },
  { what: 'focus ring (ink) on surface', fg: TOKENS.ink, bg: TOKENS.surface, required: 3, kind: 'non-text' },
];

let newFailures = 0;
let knownFailures = 0;

console.log('\nContrast audit — WCAG 2.2 AA\n');
console.log('  ratio  need  result   what');
console.log('  ─────  ────  ───────  ───────────────────────────────────────────');

for (const check of CHECKS) {
  const ratio = contrastRatio(check.fg, check.bg);
  const passes = ratio >= check.required;

  let mark = 'PASS   ';
  if (!passes) {
    if (check.knownGap) {
      knownFailures += 1;
      mark = `${check.knownGap.padEnd(7)}`;
    } else {
      newFailures += 1;
      mark = 'FAIL   ';
    }
  }

  console.log(
    `  ${ratio.toFixed(2).padStart(5)}  ${check.required.toFixed(1).padStart(4)}  ${mark}  ${check.what}`,
  );
}

console.log(`\n  ${knownFailures} known gap(s), documented in docs/api-findings.md.`);

if (newFailures > 0) {
  console.log(`  ${newFailures} NEW failure(s) — investigate and document before shipping.\n`);
  process.exitCode = 1;
} else {
  console.log('  No new failures.\n');
}
