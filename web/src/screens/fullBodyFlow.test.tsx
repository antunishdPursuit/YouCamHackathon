import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPaletteFromReading, hexToLab, type TryOnPanel, type TryOnResponse } from '@yincol/shared';
import { ResultsScreen } from './ResultsScreen.js';
import { AnalysisScreen } from './AnalysisScreen.js';
import { IntroScreen } from './IntroScreen.js';
const panel = (url: string, stage: 'completeLook' | 'garmentOnly' = 'completeLook'): TryOnPanel => ({
  result: { status: 'ready', imageUrl: url, alt: 'Test-only response' }, provenance: 'live', stage,
});
const analysis = { mode: 'fixture' as const, palette: buildPaletteFromReading({
  skin: hexToLab('#e0b492'), hair: hexToLab('#3b2a22'), eye: hexToLab('#4a3728'),
  eyebrow: hexToLab('#4a352a'), lip: hexToLab('#bc7a72'),
}) };
const tryOn: TryOnResponse = {
  mode: 'live', portrait: panel('/close-source'),
  garments: { a: panel('/close-a-bare', 'garmentOnly'), b: panel('/close-b-bare', 'garmentOnly') },
  completeLooks: { a: panel('/close-a'), b: panel('/close-b') },
  fullBody: {
    mode: 'live',
    garments: { a: panel('/full-a-bare', 'garmentOnly'), b: panel('/full-b-bare', 'garmentOnly') },
    completeLooks: { a: panel('/full-a'), b: panel('/full-b') },
  },
};
const noop = () => {};
const props = { analysis, tryOn, garmentIds: ['a', 'b'], makeupLookId: 'champagne-halo',
  axis: 'garments' as const, keptGarmentIds: [], keptMakeupWinners: [],
  portraitSize: { width: 900, height: 1000 }, fullBodySize: { width: 1000, height: 1600 },
  onResultView: noop, onAxisChange: noop, onToggleGarment: noop, onToggleMakeup: noop,
  onEditInputs: noop, onStartOver: noop,
};
describe('full-body rendering contract', () => {
  it('renders only the selected view and uses its portrait framing', () => {
    const full = renderToStaticMarkup(<ResultsScreen {...props} resultView="fullBody" />);
    expect(full).toContain('src="/full-a"'); expect(full).not.toContain('src="/close-a"');
    expect(full).toContain('aspect-ratio:0.625 / 1');
    expect(full).not.toContain('2.5D');
    const close = renderToStaticMarkup(<ResultsScreen {...props} resultView="closeup" />);
    expect(close).toContain('src="/close-a"'); expect(close).not.toContain('src="/full-a"');
  });
  it('compares makeup on the full-body garment result', () => {
    const html = renderToStaticMarkup(<ResultsScreen {...props} resultView="fullBody" axis="makeup" />);
    expect(html).toContain('src="/full-a-bare"'); expect(html).toContain('src="/full-a"');
    expect(html).not.toContain('src="/close-a-bare"');
  });
  it('has no full-body selector when this request did not generate that view', () => {
    const { fullBody: _unused, ...closeOnly } = tryOn;
    const html = renderToStaticMarkup(<ResultsScreen {...props} tryOn={closeOnly} resultView="closeup" />);
    expect(html).not.toContain('Preview view');
    expect(html).not.toContain('/api/full-body/');
  });
  it('shows a failure without discarding the other outfit', () => {
    const failed = { ...tryOn, fullBody: { ...tryOn.fullBody!, completeLooks: {
      a: panel('/full-a'), b: { provenance: 'live' as const, result: { status: 'failed' as const, reason: 'Test failure' } },
    } } };
    const html = renderToStaticMarkup(<ResultsScreen {...props} tryOn={failed} resultView="fullBody" />);
    expect(html).toContain('src="/full-a"'); expect(html).toContain('Test failure');
    expect(html).not.toContain('src="/full-b"');
    expect(html).not.toContain('preview preview');
  });
  it('names full-body work in Generate and keeps unfinished work in progress', () => {
    const html = renderToStaticMarkup(<AnalysisScreen done={false} imagesLeaveTab={true}
      fullBody phase="previews" failed={false} onFinished={noop} onBack={noop} />);
    expect(html).toContain('Generating full-body outfits and makeup');
    expect(html.match(/In progress/g)).toHaveLength(2);
    expect(html).not.toContain('Saved YouCam results');
  });
});


it('lists full-body and close-up kept looks separately on Start', () => {
  const html = renderToStaticMarkup(<IntroScreen onBegin={noop} resuming imagesLeaveTab={true}
    garmentIds={['a', 'b']} makeupLookId="champagne-halo"
    keptGarmentIds={['a']} keptMakeupWinners={[]}
    fullBodyKeptGarmentIds={['b']} fullBodyKeptMakeupWinners={['completeLook']} />);
  expect(html).toContain('Close-up · Garment A');
  expect(html).toContain('Full body · Garment B');
  expect(html).toContain('Full body · Complete look — Champagne Halo');
  expect(html).not.toContain('Nothing kept yet');
});
