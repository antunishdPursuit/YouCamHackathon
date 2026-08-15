/**
 * The shade-name table — 12 hue bins × 3 lightness bins, 36 fixed names.
 *
 * Names are chosen from this table by position in colour space. There is no randomness
 * and no generation: the same colour always gets the same name.
 *
 * Storybook naming, plain reasoning. The poetry lives here in the label and never in
 * the sentence that explains why a colour suits.
 *
 * A cell has to work for both a pale and a vivid colour of that hue, because the table
 * is indexed by hue and lightness only — chroma is not a third axis here. That is why
 * bin 11 light is "Fairy Floss", which reads correctly for a barely-there rose and for
 * a bright pink, rather than something like "Ivory", which only reads for one of them.
 */

/** 0–30, 30–60, … 330–360. Index = floor(hue / 30). */
const HUE_BIN_COUNT = 12;

/** 0 = light (L* ≥ 67), 1 = mid (45 ≤ L* < 67), 2 = deep (L* < 45). */
const LIGHTNESS_BIN_COUNT = 3;

/** `NAMES[hueBin][lightnessBin]`. */
const NAMES: readonly (readonly [string, string, string])[] = [
  /*   0–30  red-rose      */ ['Blush Sonnet', 'Strawberry Moon', 'Velvet Carmine'],
  /*  30–60  coral         */ ['Peach Blossom Dusk', 'Coral Lantern', 'Amber Ember'],
  /*  60–90  amber gold    */ ['Ivory Knight', 'Gilded Apricot', 'Chestnut Reverie'],
  /*  90–120 olive gold    */ ['Chamomile Light', 'Antique Olive', 'Moss Chapel'],
  /* 120–150 green         */ ['Pear Whisper', 'Fern Locket', 'Forest Vespers'],
  /* 150–180 jade          */ ['Mint Confetti', 'Jade Ribbon', 'Deep Laurel'],
  /* 180–210 teal          */ ['Seafoam Lace', 'Lagoon Keepsake', 'Midnight Teal'],
  /* 210–240 sky blue      */ ['Faint Sky Waltz', 'Cornflower Hymn', 'Twilight Harbour'],
  /* 240–270 blue violet   */ ['Periwinkle Dream', 'Bluebell Sonata', 'Ink Iris'],
  /* 270–300 violet        */ ['Wisteria Whisper', 'Lilac Carousel', 'Plum Nocturne'],
  /* 300–330 orchid        */ ['Orchid Sugar', 'Aurora Reverie', 'Mulberry Crown'],
  /* 330–360 pink rose     */ ['Fairy Floss', 'Rosewater Bell', 'Garnet Ballad'],
];

const hueBin = (hue: number): number => {
  const wrapped = ((hue % 360) + 360) % 360;
  return Math.min(HUE_BIN_COUNT - 1, Math.floor(wrapped / 30));
};

const lightnessBin = (lightness: number): number => {
  if (lightness >= 67) return 0;
  if (lightness >= 45) return 1;
  return 2;
};

const nameAt = (hb: number, lb: number): string => {
  const row = NAMES[((hb % HUE_BIN_COUNT) + HUE_BIN_COUNT) % HUE_BIN_COUNT];
  // The table is a complete 12×3 literal, so this is unreachable; the throw exists so
  // a future edit that drops a row fails loudly instead of naming a swatch "undefined".
  if (!row) throw new Error(`Shade-name table is missing hue bin ${hb}`);
  return row[((lb % LIGHTNESS_BIN_COUNT) + LIGHTNESS_BIN_COUNT) % LIGHTNESS_BIN_COUNT] as string;
};

/**
 * Pick a name for a colour, avoiding names already used elsewhere in the same palette.
 *
 * Two swatches can legitimately land in the same cell — the six role recipes are close
 * together inside one hue window. Rather than allow a duplicate, we walk a fixed
 * candidate order: the exact cell, then the other lightness bins of the same hue, then
 * neighbouring hue bins outward. The walk is deterministic, so the resolution of a
 * collision is as reproducible as the collision itself.
 */
export function pickShadeName(hue: number, lightness: number, taken: ReadonlySet<string>): string {
  const hb = hueBin(hue);
  const lb = lightnessBin(lightness);

  const candidates: string[] = [
    nameAt(hb, lb),
    nameAt(hb, lb + 1),
    nameAt(hb, lb + 2),
  ];

  // Then neighbouring hues, alternating right and left, at the same lightness first.
  for (let step = 1; step <= 6; step += 1) {
    for (const offset of [step, -step]) {
      for (let dl = 0; dl < LIGHTNESS_BIN_COUNT; dl += 1) {
        candidates.push(nameAt(hb + offset, lb + dl));
      }
    }
  }

  for (const candidate of candidates) {
    if (!taken.has(candidate)) return candidate;
  }

  // 36 names against at most 6 swatches — unreachable in practice.
  return candidates[0] as string;
}

export const SHADE_NAME_COUNT = NAMES.length * LIGHTNESS_BIN_COUNT;
export const ALL_SHADE_NAMES: readonly string[] = NAMES.flat();
