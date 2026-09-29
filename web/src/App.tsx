/**
 * The shell: one reducer, four clear stages.
 *
 * Everything runs on fixtures by default, so the whole flow is walkable with no
 * network and no credits. Live Skin Analysis and live try-on are separate opt-in
 * server flags. The browser asks which of them are on before it reads a file, because
 * in fixture mode it must not read one at all.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  ApiError,
  checkRuntimeHealth,
  requestAnalysis,
  requestSkinAnalysis,
  requestTryOn,
  requestVideo,
  type RuntimeMode,
} from './api/client.js';
import { BackendStatus, type BackendReadiness } from './components/BackendStatus.js';
import { StateNotice } from './components/StateNotice.js';
import { PrivacyBar } from './components/PrivacyBar.js';
import { Wordmark } from './components/ornament.js';
import { Button } from './components/controls.js';
import { PreviousLooks, SavedMediaDownloads, CurrentMediaDownloads } from './components/PreviousLooks.js';
import { useSavedLooks } from './state/useSavedLooks.js';
import { readSavedLook, openSavedLook, type LookSettings, type OpenedLook } from './state/savedLooks.js';
import { loadDemoLook } from './state/demoLook.js';
import type { CachedGeneration } from './state/generationCache.js';
import { IntroScreen } from './screens/IntroScreen.js';
import { InputsScreen } from './screens/InputsScreen.js';
import { AnalysisScreen } from './screens/AnalysisScreen.js';
import { ResultsScreen } from './screens/ResultsScreen.js';
import {
  initialState,
  inputsComplete,
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

const BACKEND_STATUS_DELAY_MS = 1_000;
const BACKEND_REQUEST_TIMEOUT_MS = 12_000;
const BACKEND_RETRY_DELAY_MS = 3_000;
const BACKEND_SLOW_RETRY_DELAY_MS = 12_000;
const BACKEND_MAX_ATTEMPTS = 6;

const STAGE_LABELS: Readonly<Record<Step, string>> = {
  intro: 'Start',
  inputs: 'Add inputs',
  generate: 'Generate',
  results: 'Results',
};

function StageProgress({ step, consentGiven, busy, onNavigate }: {
  step: Step;
  consentGiven: boolean;
  busy: boolean;
  onNavigate: (step: 'intro' | 'inputs') => void;
}) {
  const activeIndex = STEP_ORDER.indexOf(step);

  return (
    <nav aria-label="Progress" className="min-w-0 w-full max-w-[62.5rem] flex-1">
      <ol className="grid grid-cols-4 gap-3">
        {STEP_ORDER.map((stage, index) => {
          const current = stage === step;
          const complete = index < activeIndex;
          const canNavigate = !current && !busy && (
            stage === 'intro' || (stage === 'inputs' && consentGiven)
          );
          const className = `flex min-h-[44px] w-full items-center justify-center border-t-2 py-3 text-center text-xs sm:text-sm ${
            current || complete || canNavigate
              ? 'border-gold font-semibold text-ink'
              : 'border-gold/30 text-ink-soft'
          }`;
          return (
            <li key={stage}>
              {canNavigate && (stage === 'intro' || stage === 'inputs') ? (
                <button
                  type="button"
                  onClick={() => onNavigate(stage)}
                  className={`${className} underline underline-offset-4 hover:bg-surface`}
                >
                  {STAGE_LABELS[stage]}
                </button>
              ) : (
                <span aria-current={current ? 'step' : undefined} className={className}>
                  <span className="sr-only">{current ? 'Current: ' : complete ? 'Complete: ' : ''}</span>
                  {STAGE_LABELS[stage]}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function App() {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode | null>(null);
  const [inputSessionId, setInputSessionId] = useState(0);
  const [generationPhase, setGenerationPhase] = useState<'checking' | 'analysis' | 'previews'>('checking');
  const generationRunning = useRef(false);
  const { looks, loading: historyLoading, error: historyError, saveStatus, setSaveStatus,
    save: saveLook, remove: removeLook, refresh: refreshHistory, attachVideo } = useSavedLooks();
  const [sessionVideoByImage, setSessionVideoByImage] = useState<Record<string, string>>({});
  const [videoStatusByImage, setVideoStatusByImage] = useState<Record<string, 'pending' | 'failed'>>({});
  const [activeHistoryKey, setActiveHistoryKey] = useState<string | null>(null);
  const [openedLook, setOpenedLook] = useState<OpenedLook | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyActionError, setHistoryActionError] = useState<{ message: string; retryRemoval?: boolean } | null>(null);
  const lastCompleted = useRef<{ cache: CachedGeneration; settings: LookSettings } | null>(null);
  useEffect(() => () => openedLook?.dispose(), [openedLook]);
  const saveCompleted = useCallback((cache: CachedGeneration, settings: LookSettings) => {
    lastCompleted.current = { cache, settings };
    setActiveHistoryKey(cache.key);
    void saveLook(cache, settings, () => true);
  }, [saveLook]);
  const activeSavedLook = looks.find(look => look.key === activeHistoryKey);

  const mainRef = useRef<HTMLElement>(null);
  const currentView = state.step;
  const previousStep = useRef(currentView);
  useEffect(() => {
    // Old gallery bookmarks now enter the regular consent/upload flow.
    if (window.location.hash === '#full-body') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (previousStep.current === currentView) return;
    previousStep.current = currentView;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentView]);
  const [generationSource, setGenerationSource] = useState<'cache' | 'network' | null>(null);

  /**
   * Whether the photograph will leave the tab, which only the server can say.
   *
   * `null` until it answers. The privacy bar makes no claim in the meantime — the whole
   * point of the sentence is that it is true, and a default would be a guess.
   */
  const [imagesLeaveTab, setImagesLeaveTab] = useState<boolean | null>(null);
  const [backendReadiness, setBackendReadiness] = useState<BackendReadiness>('checking');
  const [backendRetry, setBackendRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    let statusTimer: number | undefined;
    let activeController: AbortController | undefined;

    setBackendReadiness('checking');
    setImagesLeaveTab(null);
    setRuntimeMode(null);

    statusTimer = window.setTimeout(() => {
      if (!cancelled) {
        setBackendReadiness((current) => (current === 'checking' ? 'starting' : current));
      }
    }, BACKEND_STATUS_DELAY_MS);

    const checkBackend = (attempt: number) => {
      if (cancelled) return;

      const controller = new AbortController();
      activeController = controller;
      const timeout = window.setTimeout(() => controller.abort(), BACKEND_REQUEST_TIMEOUT_MS);

      void checkRuntimeHealth(controller.signal)
        .then((mode) => {
          window.clearTimeout(timeout);
          if (cancelled) return;

          setBackendReadiness('ready');
          setImagesLeaveTab(mode.liveSkinAnalysis || mode.liveTryOn);
          setRuntimeMode(mode);
        })
        .catch(() => {
          window.clearTimeout(timeout);
          if (cancelled) return;

          if (attempt >= BACKEND_MAX_ATTEMPTS) {
            setBackendReadiness('delayed');
            return;
          }

          setBackendReadiness('starting');
          const delay = attempt < 3 ? BACKEND_RETRY_DELAY_MS : BACKEND_SLOW_RETRY_DELAY_MS;
          retryTimer = window.setTimeout(() => checkBackend(attempt + 1), delay);
        });
    };

    checkBackend(1);

    return () => {
      cancelled = true;
      activeController?.abort();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
    };
  }, [backendRetry]);

  const retryBackend = useCallback(() => {
    setBackendRetry((current) => current + 1);
  }, []);

  /**
   * Which generation the results on their way back belong to.
   *
   * A generation is several awaits long, and the delete link stays live for all of them.
   * Without this counter the deleted results come back: `clearPortrait` empties the
   * state, then the still-pending `analysisReady` and `tryOnReady` put the same face
   * straight back on screen, and `writeGenerationCache` re-seeds the cache that the
   * delete had just cleared. That makes the delete a gesture rather than a deletion,
   * which is the one thing the privacy bar promises it is not.
   *
   * Every run captures the id it started with. Anything that voids the results bumps it,
   * and a run whose id no longer matches stops writing — no dispatch, no cache entry,
   * and no error banner for work the shopper already discarded.
   */
  const generationId = useRef(0);

  /** Discard whatever is in flight along with whatever has already been produced. */
  const voidGeneration = useCallback(() => {
    generationId.current += 1;
    clearGenerationCache();
    setGenerationSource(null);
    setOpenedLook(null);
    setActiveHistoryKey(null);
    lastCompleted.current = null;
    generationRunning.current = false;
    setSessionVideoByImage({});
    setVideoStatusByImage({});
  }, []);

  /**
   * Kick off both calls together when analysis begins.
   *
   * The portrait reference remains a fixture key for fixture mode. When the server has
   * the opt-in live try-on flag enabled, the browser-held portrait and garment bytes are
   * sent in the same request and uploaded server-side through the feature File APIs.
   */
  const beginAnalysis = useCallback(async () => {
    if (backendReadiness !== 'ready' || generationRunning.current || !inputsComplete(state)) return;
    generationRunning.current = true;
    setGenerationPhase('checking');

    // Starting a generation also supersedes any earlier one still in flight.
    generationId.current += 1;
    const runId = generationId.current;
    const superseded = () => generationId.current !== runId;

    setGenerationSource(null);
    dispatch({ type: 'analysisStarted' });
    const currentRuntime = runtimeMode;
    const portraitRef = 'fixture:portrait';
    const portrait = state.portrait;
    const garmentInputs = [state.garmentInputs.a, state.garmentInputs.b] as const;
    const settings: LookSettings = { garmentIds: state.garmentIds, makeupLookId: state.makeupLookId,
      ...(portrait ? { portraitSize: { width: portrait.width, height: portrait.height } } : {}),
      ...(state.fullBody.portrait ? { fullBodySize: { width: state.fullBody.portrait.width, height: state.fullBody.portrait.height } } : {}) };
    setOpenedLook(null);
    setActiveHistoryKey(null);
    lastCompleted.current = null;

    try {
      const mode = await checkRuntimeHealth();
      if (superseded()) return;
      const willUpload = mode.liveSkinAnalysis || mode.liveTryOn;
      setImagesLeaveTab(willUpload);
      setRuntimeMode(mode);
      if (state.fullBody.enabled && !mode.fullBodyTryOn) {
        throw new ApiError('Full-body generation is unavailable. Return to inputs and turn off the option.', 'general');
      }
      if ((willUpload && imagesLeaveTab !== true) || (mode.liveSkinAnalysis !== currentRuntime?.liveSkinAnalysis || mode.liveTryOn !== currentRuntime?.liveTryOn)) {
        throw new ApiError('Generation settings changed. Return to inputs to review the updated upload and unit estimate before generating.', 'general');
      }
      const cacheKey = await generationCacheKey({
        portrait,
        fullBody: state.fullBody,
        garmentInputs,
        makeupLookId: state.makeupLookId,
        liveSkinAnalysis: mode.liveSkinAnalysis,
        liveTryOn: mode.liveTryOn,
      });
      if (!cacheKey) throw new ApiError('Could not match your photos to saved looks. Use HTTPS or localhost and try again; no new previews were generated.', 'general');
      const cached = readGenerationCache(cacheKey);
      if (superseded()) return;

      // A failed history read must never silently trigger paid work for an existing look.
      const saved = !cached ? await readSavedLook(cacheKey).catch(() => {
        throw new ApiError('Could not check saved looks. Check browser storage and try again before generating.', 'general');
      }) : undefined;
      if (superseded()) return;
      if (saved) {
        const restored = openSavedLook(saved);
        setOpenedLook(restored);
        setActiveHistoryKey(saved.key);
        setGenerationSource('cache');
        setSaveStatus('saved');
        dispatch({ type: 'analysisReady', analysis: saved.analysis });
        dispatch({ type: 'tryOnReady', tryOn: restored.tryOn });
        void refreshHistory();
        return;
      }

      if (cached) {
        setGenerationSource('cache');
        dispatch({ type: 'analysisReady', analysis: cached.analysis });
        dispatch({ type: 'tryOnReady', tryOn: cached.tryOn });
        saveCompleted(cached, settings);
        return;
      }

      setGenerationSource('network');
      setGenerationPhase('analysis');

      const [analysis, skinAnalysis] = await Promise.all([
        requestAnalysis(portraitRef),
        portrait
          ? requestSkinAnalysis(portrait).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (superseded()) return;

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

      setGenerationPhase('previews');
      const tryOn = await requestTryOn({
        portraitRef,
        portrait,
        fullBody: state.fullBody,
        garmentIds: state.garmentIds,
        garmentInputs,
        makeupLookId: state.makeupLookId ?? '',
      });
      if (superseded()) return;

      const completed = { key: cacheKey, savedAt: Date.now(), analysis: combinedAnalysis, tryOn };
      writeGenerationCache(completed);
      dispatch({ type: 'tryOnReady', tryOn });
      saveCompleted(completed, settings);
    } catch (error) {
      // A discarded generation must not raise a banner about itself either.
      if (superseded()) return;

      dispatch({
        type: 'failed',
        message: error instanceof Error ? error.message : 'Something went wrong.',
        code: error instanceof ApiError ? error.code : 'general',
      });
    } finally {
      if (!superseded()) generationRunning.current = false;
    }
  }, [imagesLeaveTab, backendReadiness, runtimeMode, state, saveCompleted, setSaveStatus, refreshHistory]);

  const handleClearPortrait = useCallback(async () => {
    voidGeneration();
    setInputSessionId(current => current + 1);
    dispatch({ type: 'clearPortrait' });
    setHistoryBusy(true);
    setHistoryActionError(null);
    try { await removeLook(); }
    catch { setHistoryActionError({ message: 'Your inputs were cleared, but saved looks could not be deleted. Retry removal to finish.', retryRemoval: true }); }
    finally { setHistoryBusy(false); }
  }, [voidGeneration, removeLook]);

  const handleOpenLook = useCallback(async (key: string) => {
    const openingId = ++generationId.current;
    setHistoryBusy(true);
    setHistoryActionError(null);
    try {
      const look = await readSavedLook(key);
      if (openingId !== generationId.current) return;
      if (!look) { await refreshHistory(); throw new Error('This saved look is no longer on this browser.'); }
      voidGeneration();
      const restored = openSavedLook(look);
      setOpenedLook(restored);
      setActiveHistoryKey(key);
      setGenerationSource('cache');
      setSaveStatus('saved');
      dispatch({ type: 'restoreGeneration', analysis: look.analysis, tryOn: restored.tryOn,
        garmentIds: look.garmentIds, makeupLookId: look.makeupLookId });
    } catch (error) { if (openingId === generationId.current) setHistoryActionError({ message: error instanceof Error ? error.message : 'Could not open this saved look.' }); }
    finally { setHistoryBusy(false); }
  }, [refreshHistory, setSaveStatus, voidGeneration]);

  const handleGenerateVideo = useCallback(async (imageUrl: string) => {
    setVideoStatusByImage(current => ({ ...current, [imageUrl]: 'pending' }));
    try {
      const response = await requestVideo(imageUrl);
      if (response.video.result.status !== 'ready') {
        throw new Error(response.video.result.reason);
      }
      const videoUrl = response.video.result.videoUrl;
      setSessionVideoByImage(current => ({ ...current, [imageUrl]: videoUrl }));
      setVideoStatusByImage(({ [imageUrl]: _drop, ...rest }) => rest);

      // Persisted alongside history only when this result is one we've reopened — its
      // saved image ids are already known then. A brand-new, not-yet-reopened generation's
      // video still plays for this session; linking it into that generation's own history
      // entry (once saved) is a follow-up, not done here.
      const savedImageId = openedLook?.downloads.find(entry => entry.url === imageUrl)?.id;
      if (savedImageId && activeHistoryKey) {
        const videoBlob = await fetch(videoUrl).then(response => response.blob());
        await attachVideo(activeHistoryKey, savedImageId, videoBlob);
      }
    } catch {
      setVideoStatusByImage(current => ({ ...current, [imageUrl]: 'failed' }));
    }
  }, [openedLook, activeHistoryKey, attachVideo]);

  const handleDeleteLook = useCallback(async (key: string) => {
    setHistoryBusy(true);
    setHistoryActionError(null);
    clearGenerationCache();
    if (activeHistoryKey === key) { voidGeneration(); dispatch({ type: 'startOver' }); }
    try { await removeLook(key); }
    catch { /* The history shelf reports the failed deletion. */ }
    finally { setHistoryBusy(false); }
  }, [activeHistoryKey, removeLook, voidGeneration]);

  const handleStartOver = useCallback(() => {
    voidGeneration();
    dispatch({ type: 'startOver' });
  }, [voidGeneration]);

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

  useEffect(() => {
    const url = state.fullBody.portrait?.previewUrl;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [state.fullBody.portrait?.previewUrl]);
  useEffect(() => {
    const url = state.fullBody.trousers?.previewUrl;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [state.fullBody.trousers?.previewUrl]);

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
            previousLooks={<PreviousLooks looks={looks} loading={historyLoading} error={historyError}
              pending={historyBusy} onOpen={handleOpenLook} onDelete={handleDeleteLook}
              onRetry={() => { void refreshHistory(); }} className="xl:col-start-1 xl:row-start-1" />}
            imagesLeaveTab={imagesLeaveTab}
            resuming={Boolean(state.fullBody.enabled || state.portrait || state.garmentInputs.a || state.garmentInputs.b || state.makeupLookId)}
            onBeginLive={() => {
              generationId.current += 1;
              dispatch({ type: 'giveConsent' });
              dispatch({ type: 'editInputs' });
            }}
            onBeginDemo={() => {
              // Zero calls to the API server: no health check, no /api route. The demo
              // must work even while that service is asleep.
              generationId.current += 1;
              voidGeneration();
              dispatch({ type: 'giveConsent' });
              const demo = loadDemoLook();
              dispatch({ type: 'restoreGeneration', analysis: demo.analysis, tryOn: demo.tryOn,
                garmentIds: demo.garmentIds, makeupLookId: demo.makeupLookId });
            }}
          />
        );

      case 'inputs':
        return (
          <InputsScreen
            key={inputSessionId}
            portrait={state.portrait}
            garmentInputs={state.garmentInputs}
            makeupLookId={state.makeupLookId}
            imagesLeaveTab={imagesLeaveTab}
            onPortrait={(image) => {
              voidGeneration();
              dispatch({ type: 'setPortrait', portrait: image });
            }}
            onGarment={(slot, image) => {
              voidGeneration();
              dispatch({ type: 'setGarmentInput', slot, image });
            }}
            onClearGarment={(slot) => {
              voidGeneration();
              dispatch({ type: 'clearGarmentInput', slot });
            }}
            onChooseMakeup={(lookId) => {
              if (lookId === state.makeupLookId) return;
              voidGeneration();
              dispatch({ type: 'chooseMakeup', lookId });
            }}
            onContinue={beginAnalysis}
            onBack={() => dispatch({ type: 'goTo', step: 'intro' })}
            backendReadiness={backendReadiness}
            fullBody={state.fullBody}
            fullBodyAvailable={runtimeMode?.fullBodyTryOn === true}
            onEnableFullBody={(enabled) => {
              voidGeneration();
              dispatch({ type: 'enableFullBody', enabled });
            }}
            onFullBodyInput={(slot, image) => {
              voidGeneration();
              dispatch({ type: 'setFullBodyInput', slot, image });
            }}
            estimatedUnits={runtimeMode ? (runtimeMode.liveTryOn ? 6 : 0) +
              (runtimeMode.liveSkinAnalysis ? 12 : 0) + (state.fullBody.enabled ? 8 : 0) : null}
          />
        );

      case 'generate':
        return (
          <AnalysisScreen
            done={analysisDone}
            phase={generationPhase}
            failed={Boolean(state.error)}
            fullBody={state.fullBody.enabled}
            onBack={() => dispatch({ type: 'editInputs' })}
            cached={generationSource === 'cache'}
            imagesLeaveTab={imagesLeaveTab}
            onFinished={() => dispatch({ type: 'goTo', step: 'results' })}
          />
        );

      case 'results':
        return state.analysis && state.tryOn ? (
          <ResultsScreen
            analysis={state.analysis}
            {...(state.fullBody.portrait ? { fullBodySize: {
              width: state.fullBody.portrait.width, height: state.fullBody.portrait.height,
            } } : {})}
            videoByImage={{ ...openedLook?.videoByImage, ...sessionVideoByImage }}
            videoStatusByImage={videoStatusByImage}
            onGenerateVideo={handleGenerateVideo}
            motionKindByImage={openedLook?.motionKindByImage}
            {...(openedLook?.look.portraitSize ? { portraitSize: openedLook.look.portraitSize } : {})}
            {...(openedLook?.look.fullBodySize ? { fullBodySize: openedLook.look.fullBodySize } : {})}
            tryOn={state.tryOn}
            garmentIds={state.garmentIds}
            makeupLookId={state.makeupLookId}
            axis={state.axis}
            {...(state.portrait
              ? { portraitSize: { width: state.portrait.width, height: state.portrait.height } }
              : {})}
            onAxisChange={(axis) => dispatch({ type: 'setAxis', axis })}
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
          <StageProgress step={state.step} consentGiven={state.consentGiven} busy={state.busy}
            onNavigate={(step) => dispatch(step === 'inputs'
              ? { type: 'editInputs' } : { type: 'goTo', step: 'intro' })} />
        </header>

        {SHOWS_PORTRAIT.has(state.step) && (state.portrait || state.tryOn) ? (
          <div className="mb-6">
            <PrivacyBar onDelete={handleClearPortrait} imagesLeaveTab={imagesLeaveTab} disabled={historyBusy} />
          </div>
        ) : null}

        {state.error && state.errorCode !== 'noFace' ? (
          <div
            role="alert"
            className="mb-6 rounded-card border border-gold/60 bg-powder px-5 py-4 text-base text-ink"
          >
            <p>{state.error}</p>
            {state.step !== 'generate' ? <Button
              variant="quiet"
              className="mt-3 !px-3 text-sm"
              onClick={() => dispatch({ type: 'dismissError' })}
            >
              Dismiss
            </Button> : null}
          </div>
        ) : null}

        <main id="main" ref={mainRef} tabIndex={-1}
          aria-label={STAGE_LABELS[state.step]} className="flex-1">
          {state.step !== 'results' ? <BackendStatus readiness={backendReadiness} onRetry={retryBackend} /> : null}
          {historyActionError ? <div role="alert" className="mb-6 rounded-card border border-gold/40 bg-surface p-4">
            <p>{historyActionError.message}</p>
            {historyActionError.retryRemoval ? <Button variant="quiet" className="mt-3" disabled={historyBusy} onClick={() => { void handleClearPortrait(); }}>Retry removing all saved data</Button> : null}
            <Button variant="link" onClick={() => setHistoryActionError(null)}>Dismiss</Button>
          </div> : null}
          {state.step === 'results' && activeHistoryKey ? <section aria-label="Result storage" className="mb-6 rounded-card border border-gold/40 bg-surface p-4">
            <p role="status" className="text-sm text-ink-soft">{activeSavedLook ? 'Saved on this browser. Find this comparison in Previous looks on Start.'
              : saveStatus === 'failed' ? 'Not saved: browser storage is full, unavailable, or a media download failed. Your current results are still here.'
              : saveStatus === 'empty' ? 'There are no completed previews to save.' : 'Saving your completed previews on this browser…'}</p>
            {!activeSavedLook && saveStatus === 'failed' && lastCompleted.current ? <Button variant="quiet" className="mt-3" onClick={() => {
              const completed = lastCompleted.current;
              if (completed) saveCompleted(completed.cache, completed.settings);
            }}>Retry saving — no new generation</Button> : null}
            {activeSavedLook ? <SavedMediaDownloads look={activeSavedLook} /> : state.tryOn ? <CurrentMediaDownloads generation={state.tryOn} /> : null}
          </section> : null}
          {screen}
        </main>
      </div>
    </div>
  );
}
