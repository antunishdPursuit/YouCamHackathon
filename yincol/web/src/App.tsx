/**
 * The shell: one reducer, one screen at a time.
 *
 * Everything runs on fixtures by default, so the whole nine-screen flow is walkable
 * with no network and no credits.
 */

import { useCallback, useEffect, useReducer } from 'react';
import { requestAnalysis, requestTryOn } from './api/client.js';
import { PrivacyBar } from './components/PrivacyBar.js';
import { Wordmark } from './components/ornament.js';
import { Button } from './components/controls.js';
import { IntroScreen } from './screens/IntroScreen.js';
import { CaptureScreen } from './screens/CaptureScreen.js';
import { SelectionScreen } from './screens/SelectionScreen.js';
import { AnalysisScreen } from './screens/AnalysisScreen.js';
import { ColorsScreen } from './screens/ColorsScreen.js';
import { PreviewScreen } from './screens/PreviewScreen.js';
import { CompareScreen } from './screens/CompareScreen.js';
import { LookCardScreen } from './screens/LookCardScreen.js';
import { initialState, sessionReducer } from './state/session.js';

/** Screens that display the portrait, and therefore carry the privacy affordance. */
const SHOWS_PORTRAIT = new Set(['capture', 'analysis', 'colors', 'preview', 'compare', 'lookCard']);

export function App() {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  /**
   * Kick off both calls together when analysis begins.
   *
   * The portrait reference is a fixture key in fixture mode. In live mode it would be a
   * publicly reachable URL — the API fetches the image itself, so a local object URL
   * would be meaningless to it.
   */
  const beginAnalysis = useCallback(async () => {
    dispatch({ type: 'analysisStarted' });
    const portraitRef = 'fixture:portrait';

    try {
      const analysis = await requestAnalysis(portraitRef);
      dispatch({ type: 'analysisReady', analysis });

      const tryOn = await requestTryOn(
        portraitRef,
        state.garmentIds,
        state.makeupLookId ?? '',
      );
      dispatch({ type: 'tryOnReady', tryOn });
    } catch (error) {
      dispatch({
        type: 'failed',
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  }, [state.garmentIds, state.makeupLookId]);

  // Release the object URL when the portrait is replaced or cleared, so a discarded
  // photograph is genuinely gone rather than lingering in memory.
  useEffect(() => {
    const url = state.portrait?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.portrait?.previewUrl]);

  const analysisDone = state.analysis !== null && state.tryOn !== null;

  const screen = (() => {
    switch (state.step) {
      case 'intro':
        return (
          <IntroScreen
            onBegin={() => {
              dispatch({ type: 'giveConsent' });
              dispatch({ type: 'goTo', step: 'capture' });
            }}
          />
        );

      case 'capture':
        return (
          <CaptureScreen
            portrait={state.portrait}
            onPortrait={(portrait) => dispatch({ type: 'setPortrait', portrait })}
            onContinue={() => dispatch({ type: 'goTo', step: 'selection' })}
          />
        );

      case 'selection':
        return (
          <SelectionScreen
            garmentIds={state.garmentIds}
            makeupLookId={state.makeupLookId}
            onToggleGarment={(garmentId) => dispatch({ type: 'toggleGarment', garmentId })}
            onChooseMakeup={(lookId) => dispatch({ type: 'chooseMakeup', lookId })}
            onContinue={beginAnalysis}
          />
        );

      case 'analysis':
        return (
          <AnalysisScreen
            done={analysisDone}
            onFinished={() => dispatch({ type: 'goTo', step: 'colors' })}
          />
        );

      case 'colors':
        return state.analysis ? (
          <ColorsScreen
            analysis={state.analysis}
            onContinue={() => dispatch({ type: 'goTo', step: 'preview' })}
          />
        ) : null;

      case 'preview':
        return state.analysis && state.tryOn ? (
          <PreviewScreen
            tryOn={state.tryOn}
            palette={state.analysis.palette}
            garmentIds={state.garmentIds}
            makeupLookId={state.makeupLookId}
            onContinue={() => dispatch({ type: 'goTo', step: 'compare' })}
          />
        ) : null;

      case 'compare':
        return state.analysis && state.tryOn ? (
          <CompareScreen
            tryOn={state.tryOn}
            palette={state.analysis.palette}
            garmentIds={state.garmentIds}
            makeupLookId={state.makeupLookId}
            axis={state.axis}
            garmentWinnerId={state.garmentWinnerId}
            makeupWinner={state.makeupWinner}
            onAxisChange={(axis) => dispatch({ type: 'setAxis', axis })}
            onPickGarment={(garmentId) => dispatch({ type: 'pickGarmentWinner', garmentId })}
            onPickMakeup={(winner) => dispatch({ type: 'pickMakeupWinner', winner })}
            onContinue={() => dispatch({ type: 'saveLook' })}
          />
        ) : null;

      case 'lookCard':
        return state.analysis && state.tryOn ? (
          <LookCardScreen
            tryOn={state.tryOn}
            palette={state.analysis.palette}
            garmentWinnerId={state.garmentWinnerId}
            makeupWinner={state.makeupWinner}
            makeupLookId={state.makeupLookId}
            onBack={() => dispatch({ type: 'goTo', step: 'compare' })}
            onStartOver={() => dispatch({ type: 'startOver' })}
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

      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-4">
        {state.step !== 'intro' ? (
          <header className="mb-4 flex items-center justify-center">
            <Wordmark size="sm" />
          </header>
        ) : null}

        {SHOWS_PORTRAIT.has(state.step) ? (
          <div className="mb-4">
            <PrivacyBar onDelete={() => dispatch({ type: 'clearPortrait' })} />
          </div>
        ) : null}

        {state.error ? (
          <div
            role="alert"
            className="mb-4 rounded-card border border-gold/60 bg-powder px-4 py-3 text-sm text-ink"
          >
            <p>{state.error}</p>
            <Button
              variant="quiet"
              className="mt-2 !px-3 text-sm"
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
