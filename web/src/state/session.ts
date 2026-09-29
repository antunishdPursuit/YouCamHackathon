/**
 * The session state machine.
 *
 * Source uploads live in memory. Completed outputs are saved separately in browser
 * history; opening a saved result never restores source uploads or starts provider work.
 */

import type { AnalyzeResponse, TryOnResponse } from '@yincol/shared';

export type Step =
  | 'intro'
  | 'inputs'
  | 'generate'
  | 'results';

/** The order screens advance in, used for the back affordance. */
export const STEP_ORDER: readonly Step[] = [
  'intro',
  'inputs',
  'generate',
  'results',
];

export interface CapturedImage {
  /** An object URL for the chosen file, revoked when the portrait is replaced or cleared. */
  readonly previewUrl: string;
  /** The selected source bytes stay in memory until this session ends; they are never persisted. */
  readonly file: File;
  readonly width: number;
  readonly height: number;
  readonly note?: string;
}

export type CapturedPortrait = CapturedImage;

/** Which axis the results workspace is showing. */
export type CompareAxis = 'garments' | 'makeup';
export interface FullBodyInputs {
  readonly enabled: boolean;
  readonly portrait: CapturedImage | null;
  readonly trousers: CapturedImage | null;
}

export interface SessionState {
  readonly step: Step;
  readonly consentGiven: boolean;
  readonly portrait: CapturedPortrait | null;
  readonly garmentInputs: {
    readonly a: CapturedImage | null;
    readonly b: CapturedImage | null;
  };
  /** Fixture catalog ids used only to keep the current local result pipeline working. */
  readonly garmentIds: readonly string[];
  readonly makeupLookId: string | null;
  readonly fullBody: FullBodyInputs;
  readonly analysis: AnalyzeResponse | null;
  readonly tryOn: TryOnResponse | null;
  readonly axis: CompareAxis;
  readonly error: string | null;
  /** Distinguishes "no face" from a generic failure, so the copy can differ. */
  readonly errorCode: 'noFace' | 'general' | null;
  readonly busy: boolean;
}

export const initialState: SessionState = {
  step: 'intro',
  consentGiven: false,
  portrait: null,
  garmentInputs: { a: null, b: null },
  garmentIds: [],
  makeupLookId: null,
  fullBody: { enabled: false, portrait: null, trousers: null },
  analysis: null,
  tryOn: null,
  axis: 'garments',
  error: null,
  errorCode: null,
  busy: false,
};

export type SessionAction =
  | { type: 'restoreGeneration'; analysis: AnalyzeResponse; tryOn: TryOnResponse; garmentIds: readonly string[]; makeupLookId: string | null }
  | { type: 'giveConsent' }
  | { type: 'enableFullBody'; enabled: boolean }
  | { type: 'setFullBodyInput'; slot: 'portrait' | 'trousers'; image: CapturedImage | null }
  | { type: 'goTo'; step: Step }
  | { type: 'setPortrait'; portrait: CapturedPortrait }
  | { type: 'clearPortrait' }
  | { type: 'setGarmentInput'; slot: 'a' | 'b'; image: CapturedImage }
  | { type: 'clearGarmentInput'; slot: 'a' | 'b' }
  | { type: 'editInputs' }
  | { type: 'chooseMakeup'; lookId: string }
  | { type: 'analysisStarted' }
  | { type: 'analysisReady'; analysis: AnalyzeResponse }
  | { type: 'tryOnReady'; tryOn: TryOnResponse }
  | { type: 'setAxis'; axis: CompareAxis }
  | { type: 'failed'; message: string; code?: 'noFace' | 'general' }
  | { type: 'dismissError' }
  | { type: 'startOver' };

/** Inputs are complete when the user supplied the portrait, both garments, and one makeup look. */
export const inputsComplete = (state: SessionState): boolean =>
  state.portrait !== null &&
  state.garmentInputs.a !== null &&
  state.garmentInputs.b !== null &&
  state.makeupLookId !== null &&
  (!state.fullBody.enabled || (state.fullBody.portrait !== null && state.fullBody.trousers !== null));

// Valid only for actions that represent an actual input change (a new portrait, garment,
// makeup pick, or full-body toggle) — those really do invalidate any previous result.
// `analysisStarted` must NOT spread this: it fires on every Generate click regardless of
// whether inputs changed, and wiping the result there discarded it even when a
// cached/saved result for the same inputs was about to be reused.
const clearedResults = {
  analysis: null, tryOn: null, error: null, errorCode: null,
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'restoreGeneration':
      return { ...initialState, consentGiven: state.consentGiven, step: 'results',
        analysis: action.analysis, tryOn: action.tryOn, garmentIds: action.garmentIds,
        makeupLookId: action.makeupLookId,
        fullBody: { enabled: Boolean(action.tryOn.fullBody), portrait: null, trousers: null } };

    case 'giveConsent':
      return { ...state, consentGiven: true };

    case 'goTo':
      return { ...state, step: action.step, error: null, errorCode: null };

    case 'enableFullBody':
      return { ...state, ...clearedResults, fullBody: action.enabled
        ? { ...state.fullBody, enabled: true }
        : { enabled: false, portrait: null, trousers: null } };
    case 'setFullBodyInput':
      return { ...state, ...clearedResults, fullBody: { ...state.fullBody, [action.slot]: action.image } };
    case 'setPortrait':
      return {
        ...state,
        ...clearedResults,
        portrait: action.portrait,
      };

    case 'clearPortrait':
      // One-tap delete, as promised on every screen showing the portrait. It clears the
      // analysis too — it was derived from this face, so keeping it would make the delete
      // a gesture rather than a deletion.
      return {
        ...initialState,
        consentGiven: state.consentGiven,
        step: 'inputs',
      };

    case 'setGarmentInput': {
      return {
        ...state,
        ...clearedResults,
        garmentInputs: { ...state.garmentInputs, [action.slot]: action.image },
        garmentIds: ['rosewater-cardigan', 'sage-linen-shirt'],
      };
    }

    case 'clearGarmentInput':
      return {
        ...state,
        ...clearedResults,
        garmentInputs: { ...state.garmentInputs, [action.slot]: null },
        garmentIds: state.garmentIds.filter((_id, index) =>
          action.slot === 'a' ? index !== 0 : index !== 1,
        ),
      };

    case 'editInputs':
      return {
        ...state,
        step: 'inputs',
        analysis: null,
        tryOn: null,
        axis: 'garments',
        error: null,
        errorCode: null,
        busy: false,
      };

    case 'chooseMakeup':
      if (action.lookId === state.makeupLookId) return state;
      return {
        ...state,
        ...clearedResults,
        makeupLookId: action.lookId,
      };

    case 'analysisStarted':
      return { ...state, analysis: null, tryOn: null, error: null, errorCode: null,
        busy: true, step: 'generate' };

    case 'analysisReady':
      return { ...state, analysis: action.analysis };

    case 'tryOnReady':
      return { ...state, tryOn: action.tryOn, busy: false, axis: 'garments' };

    case 'setAxis':
      return { ...state, axis: action.axis };

    case 'failed':
      return { ...state, error: action.message, errorCode: action.code ?? 'general', busy: false };

    case 'dismissError':
      return { ...state, error: null, errorCode: null };

    case 'startOver':
      // A new look starts a new comparison session. The photograph does not cross that
      // boundary.
      return {
        ...initialState,
        consentGiven: state.consentGiven,
      };

    default:
      return state;
  }
}
