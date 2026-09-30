import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPaletteFromReading, hexToLab, type TryOnPanel, type TryOnResponse } from '@yincol/shared';
import { ResultsScreen } from './ResultsScreen.js';
import { AnalysisScreen } from './AnalysisScreen.js';
import { IntroScreen } from './IntroScreen.js';
import { PreviousLooks } from '../components/PreviousLooks.js';
const panel = (url: string, stage: 'completeLook' | 'garmentOnly' | 'portraitMakeup' = 'completeLook'): TryOnPanel => ({
  result: { status: 'ready', imageUrl: url, alt: 'Test-only response' }, provenance: 'live', stage,
});
const analysis = { mode: 'fixture' as const, palette: buildPaletteFromReading({
  skin: hexToLab('#e0b492'), hair: hexToLab('#3b2a22'), eye: hexToLab('#4a3728'),
  eyebrow: hexToLab('#4a352a'), lip: hexToLab('#bc7a72'),
}) };
const tryOn: TryOnResponse = {
  mode: 'live', portrait: panel('/close-source'), portraitMadeUp: panel('/close-madeup', 'portraitMakeup'),
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
  axis: 'garments' as const,
  portraitSize: { width: 900, height: 1000 }, fullBodySize: { width: 1000, height: 1600 },
  onAxisChange: noop, onEditInputs: noop, onStartOver: noop,
};
describe('full-body rendering contract', () => {
  it('shows the two full-body outfits without an additional close-up comparison', () => {
    const html = renderToStaticMarkup(<ResultsScreen {...props} />);
    expect(html).not.toContain('src="/close-a"'); expect(html).toContain('src="/full-a"');
    expect(html).toContain('aspect-ratio:0.625 / 1');
    expect(html).toContain('Full body — shared trousers and makeup');
    // Tilt is a close-up-only affordance: one "Tilt left" control per close-up card (two
    // garments), none inside the full-body section.
    expect(html).not.toContain('Tilt left');
  });
  it('compares the original portrait against the same portrait with makeup, not a full-body section', () => {
    const html = renderToStaticMarkup(<ResultsScreen {...props} axis="makeup" />);
    expect(html).toContain('src="/close-source"'); expect(html).toContain('src="/close-madeup"');
    expect(html).not.toContain('src="/full-a"');
    expect(html).not.toContain('Full body — shared trousers and makeup');
  });
  it('renders no full-body section when this request did not generate that view', () => {
    const { fullBody: _unused, ...closeOnly } = tryOn;
    const html = renderToStaticMarkup(<ResultsScreen {...props} tryOn={closeOnly} />);
    expect(html).not.toContain('Full body — shared trousers and makeup');
    expect(html).not.toContain('src="/full-a"');
  });
  it('shows a failure without discarding the other outfit', () => {
    const failed = { ...tryOn, fullBody: { ...tryOn.fullBody!, completeLooks: {
      a: panel('/full-a'), b: { provenance: 'live' as const, result: { status: 'failed' as const, reason: 'Test failure' } },
    } } };
    const html = renderToStaticMarkup(<ResultsScreen {...props} tryOn={failed} />);
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


describe('per-image video action', () => {
  it('offers a Generate video button for a ready, non-placeholder panel', () => {
    const html = renderToStaticMarkup(<ResultsScreen {...props} />);
    expect(html).toContain('Generate video (10 units)');
  });

  it('shows a pending label and disables the button while a request is in flight', () => {
    const html = renderToStaticMarkup(
      <ResultsScreen {...props} videoStatusByImage={{ '/full-a': 'pending' }} onGenerateVideo={noop} />,
    );
    expect(html).toContain('Generating video…');
    expect(html).toMatch(/Generating video…<\/button>/);
  });

  it('offers a retry label after a failed request', () => {
    const html = renderToStaticMarkup(
      <ResultsScreen {...props} videoStatusByImage={{ '/full-a': 'failed' }} onGenerateVideo={noop} />,
    );
    expect(html).toContain('Video failed — retry');
  });

  it('plays an existing video instead of offering to generate a new one for the same image', () => {
    const html = renderToStaticMarkup(
      <ResultsScreen {...props} videoByImage={{ '/full-a': 'blob:generated-clip' }} />,
    );
    expect(html).toContain('src="blob:generated-clip"');
    // The reuse short-circuit: no "Generate video" action for the image that already has one.
    const closeACard = html.slice(html.indexOf('result-fullBody-fullBody-a'));
    expect(closeACard.slice(0, closeACard.indexOf('</article>'))).not.toContain('Generate video');
  });

  it('never offers video generation for a placeholder panel', () => {
    const placeholderTryOn: TryOnResponse = { ...tryOn, fullBody: { ...tryOn.fullBody!, completeLooks: {
      ...tryOn.fullBody!.completeLooks, a: { result: { status: 'ready', imageUrl: '/placeholder.svg', alt: 'Stand-in' }, provenance: 'placeholder' },
    } } };
    const html = renderToStaticMarkup(<ResultsScreen {...props} tryOn={placeholderTryOn} />);
    const closeACard = html.slice(html.indexOf('result-fullBody-fullBody-a'));
    expect(closeACard.slice(0, closeACard.indexOf('</article>'))).not.toContain('Generate video');
  });
});

it('offers previous looks independently of backend readiness and explains persistent storage', () => {
  const html = renderToStaticMarkup(<IntroScreen onBeginDemo={noop} onBeginLive={noop} resuming={false} imagesLeaveTab={null}
    previousLooks={<PreviousLooks looks={[]} loading={false} error={null} pending={false}
      onOpen={noop} onDelete={noop} onRetry={noop} />} />);
  expect(html).toContain('Previous looks');
  expect(html).toContain('No saved looks yet');
  expect(html).toContain('Closing the browser does not normally remove saved looks');
  expect(html).not.toContain('Looks kept');
});
