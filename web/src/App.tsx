/**
 * The shell: one reducer, four clear stages.
 *
 * Everything runs on fixtures by default, so the whole flow is walkable with no
 * network and no credits. Live Skin Analysis and live try-on are separate opt-in
 * server flags; the browser can send its tab-held files without knowing which mode
 * the server selected.
 */

import { useCallback, useEffect, useReducer, useState } from 'react';
import { ApiError, requestAnalysis, requestSkinAnalysis, requestTryOn } from './api/client.js';
import { StateNotice } from './components/StateNotice.js';
import { PrivacyBar } from './components/PrivacyBar.js';
import { Wordmark } from './components/ornament.js';
import { Button } from './components/controls.js';
import { IntroScreen } from './screens/IntroScreen.js';
import { InputsScreen } from './screens/InputsScreen.js';
import { AnalysisScreen } from './screens/AnalysisScreen.js';
import { ResultsScreen } from './screens/ResultsScreen.js';
import {
  initialState,
  sessionReducer,
  STEP_ORDER,
  type Step,
} from './state/session.js';
import {
  clearGenerationCache,
  generationCacheKey,
  readGenerationCache,
  writeGenerationCache,
} from './state/generationCache.js';

/** Screens that display the portrait, and therefore carry the privacy affordance. */
const SHOWS_PORTRAIT = new Set(['inputs', 'generate', 'results']);

const STAGE_LABELS: Readonly<Record<Step, string>> = {
  intro: 'Start',
  inputs: 'Add inputs',
  generate: 'Generate',
  results: 'Results',
};

function StageProgress({ step }: { step: Step }) {
  const activeIndex = STEP_ORDER.indexOf(step);

  return (
    <nav aria-label="Progress" className="min-w-0 w-full max-w-[62.5rem] flex-1">
      <ol className="grid grid-cols-4 gap-3">
        {STEP_ORDER.map((stage, index) => {
          const current = stage === step;
          const complete = index < activeIndex;
          return (
            <li key={stage}>
              <span
                aria-current={current ? 'step' : undefined}
                className={`block border-t-2 pt-2.5 text-center text-xs sm:text-sm ${
                  current || complete ? 'border-gold font-semibold text-ink' : 'border-gold/30 text-ink-soft'
                }`}
              >
                <span className="sr-only">{complete ? 'Complete: ' : current ? 'Current: ' : ''}</span>
                {STAGE_LABELS[stage]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function App() {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const [generationSource, setGenerationSource] = useState<'cache' | 'network' | null>(null);

  /**
   * Kick off both calls together when analysis begins.
   *
   * The portrait reference remains a fixture key for fixture mode. When the server has
   * the opt-in live try-on flag enabled, the browser-held portrait and garment bytes are
   * sent in the same request and uploaded server-side through the feature File APIs.
   */
  const beginAnalysis = useCallback(async () => {
    setGenerationSource(null);
    dispatch({ type: 'analysisStarted' });
    const portraitRef = 'fixture:portrait';
    const portrait = state.portrait;
    const garmentInputs = [state.garmentInputs.a, state.garmentInputs.b] as const;

    try {
      const cacheKey = await generationCacheKey({
        portrait,
        garmentInputs,
        makeupLookId: state.makeupLookId,
      });
      const cached = cacheKey ? readGenerationCache(cacheKey) : null;

      if (cached) {
        setGenerationSource('cache');
        dispatch({ type: 'analysisReady', analysis: cached.analysis });
        dispatch({ type: 'tryOnReady', tryOn: cached.tryOn });
        return;
      }

      setGenerationSource('network');

      const [analysis, skinAnalysis] = await Promise.all([
        requestAnalysis(portraitRef),
        portrait
          ? requestSkinAnalysis(portrait).catch(() => null)
          : Promise.resolve(null),
      ]);
      const combinedAnalysis = skinAnalysis
        ? { ...analysis, skin: skinAnalysis.skin, skinMode: skinAnalysis.mode }
        : portrait
          ? {
              ...analysis,
              skin: undefined,
              skinMode: undefined,
              skinUnavailableReason:
                'Skin appearance context is unavailable for this photograph. Your palette is unaffected.',
            }
          : analysis;
      dispatch({ type: 'analysisReady', analysis: combinedAnalysis });

      const tryOn = await requestTryOn({
        portraitRef,
        portrait,
        garmentIds: state.garmentIds,
        garmentInputs,
        makeupLookId: state.makeupLookId ?? '',
      });
      if (cacheKey) {
        writeGenerationCache({
          key: cacheKey,
          savedAt: Date.now(),
          analysis: combinedAnalysis,
          tryOn,
        });
      }
      dispatch({ type: 'tryOnReady', tryOn });
    } catch (error) {
      dispatch({
        type: 'failed',
        message: error instanceof Error ? error.message : 'Something went wrong.',
        code: error instanceof ApiError ? error.code : 'general',
      });
    }
  }, [state.garmentIds, state.garmentInputs.a, state.garmentInputs.b, state.makeupLookId, state.portrait]);

  const handleClearPortrait = useCallback(() => {
    clearGenerationCache();
    setGenerationSource(null);
    dispatch({ type: 'clearPortrait' });
  }, []);

  const handleStartOver = useCallback(() => {
    clearGenerationCache();
    setGenerationSource(null);
    dispatch({ type: 'startOver' });
  }, []);

  // Release the object URL when the portrait is replaced or cleared, so a discarded
  // photograph is genuinely gone rather than lingering in memory.
  useEffect(() => {
    const url = state.portrait?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.portrait?.previewUrl]);

  // Garment reference files follow the same tab-only lifecycle as the portrait.
  useEffect(() => {
    const url = state.garmentInputs.a?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.garmentInputs.a?.previewUrl]);

  useEffect(() => {
    const url = state.garmentInputs.b?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.garmentInputs.b?.previewUrl]);

  const analysisDone = state.analysis !== null && state.tryOn !== null;

  const screen = (() => {
    // "No face detected" replaces the screen rather than sitting above it — there is
    // nothing to show behind it, and the shopper's next move is to choose a different
    // photograph, not to dismiss a banner.
    if (state.errorCode === 'noFace') {
      return (
        <StateNotice
          tone="attention"
          title="We could not find a face"
          body="The colours are read from a face, so this photograph cannot be used. A picture taken face-on, with even light and nothing covering the face, usually works."
          actionLabel="Choose a different photograph"
          action={() => {
            dispatch({ type: 'dismissError' });
            dispatch({ type: 'goTo', step: 'inputs' });
          }}
        />
      );
    }

    switch (state.step) {
      case 'intro':
        return (
          <IntroScreen
            garmentIds={state.garmentIds}
            keptGarmentIds={state.keptGarmentIds}
            keptMakeupWinners={state.keptMakeupWinners}
            makeupLookId={state.makeupLookId}
            onBegin={() => {
              dispatch({ type: 'giveConsent' });
              dispatch({ type: 'goTo', step: 'inputs' });
            }}
          />
        );

      case 'inputs':
        return (
          <InputsScreen
            portrait={state.portrait}
            garmentInputs={state.garmentInputs}
            makeupLookId={state.makeupLookId}
            onPortrait={(image) => {
              clearGenerationCache();
              dispatch({ type: 'setPortrait', portrait: image });
            }}
            onGarment={(slot, image) => {
              clearGenerationCache();
              dispatch({ type: 'setGarmentInput', slot, image });
            }}
            onClearGarment={(slot) => {
              clearGenerationCache();
              dispatch({ type: 'clearGarmentInput', slot });
            }}
            onChooseMakeup={(lookId) => {
              clearGenerationCache();
              dispatch({ type: 'chooseMakeup', lookId });
            }}
            onContinue={beginAnalysis}
            onBack={() => dispatch({ type: 'goTo', step: 'intro' })}
          />
        );

      case 'generate':
        return (
          <AnalysisScreen
            done={analysisDone}
            cached={generationSource === 'cache'}
            onFinished={() => dispatch({ type: 'goTo', step: 'results' })}
          />
        );

      case 'results':
        return state.analysis && state.tryOn ? (
          <ResultsScreen
            analysis={state.analysis}
            tryOn={state.tryOn}
            garmentIds={state.garmentIds}
            makeupLookId={state.makeupLookId}
            axis={state.axis}
            keptGarmentIds={state.keptGarmentIds}
            keptMakeupWinners={state.keptMakeupWinners}
            onAxisChange={(axis) => dispatch({ type: 'setAxis', axis })}
            onToggleGarment={(garmentId) => dispatch({ type: 'toggleGarmentKept', garmentId })}
            onToggleMakeup={(winner) => dispatch({ type: 'toggleMakeupKept', winner })}
            onEditInputs={() => dispatch({ type: 'editInputs' })}
            onStartOver={handleStartOver}
          />
        ) : null;

      default:
        return null;
    }
  })();

  return (
    <div className="min-h-dvh bg-ground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:border focus:border-gold focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh w-full max-w-yincol flex-col px-6 pb-16 pt-6 sm:px-8 lg:px-10 xl:px-12">
        <header className="mb-7 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
          <Wordmark size="sm" />
          <StageProgress step={state.step} />
        </header>

        {SHOWS_PORTRAIT.has(state.step) && state.portrait ? (
          <div className="mb-6">
            <PrivacyBar onDelete={handleClearPortrait} />
          </div>
        ) : null}

        {state.error && state.errorCode !== 'noFace' ? (
          <div
            role="alert"
            className="mb-6 rounded-card border border-gold/60 bg-powder px-5 py-4 text-base text-ink"
          >
            <p>{state.error}</p>
            <Button
              variant="quiet"
              className="mt-3 !px-3 text-sm"
              onClick={() => dispatch({ type: 'dismissError' })}
            >
              Dismiss
            </Button>
          </div>
        ) : null}

        <main id="main" className="flex-1">
          {screen}
        </main>
      </div>
    </div>
  );
}
