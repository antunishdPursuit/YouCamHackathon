/**
 * The session state machine.
 *
 * One reducer, one shape. There is no database and no account — source uploads live in
 * memory, while completed generated results may be reused from sessionStorage until the
 * tab closes, which is exactly what the consent panel promises.
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

/**
 * The two panels on the makeup axis.
 *
 * Not `bare` and `madeUp` any more: the makeup step now runs on the garment result, so
 * the honest comparison is the same garment with and without it. The bare portrait is
 * still on screen, but it is not one of the two things being compared.
 */
export type MakeupChoice = 'garmentOnly' | 'completeLook';

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
  readonly analysis: AnalyzeResponse | null;
  readonly tryOn: TryOnResponse | null;
  readonly axis: CompareAxis;
  /** Items the user kept in the current comparison; more than one may be kept. */
  readonly keptGarmentIds: readonly string[];
  readonly keptMakeupWinners: readonly MakeupChoice[];
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
  analysis: null,
  tryOn: null,
  axis: 'garments',
  keptGarmentIds: [],
  keptMakeupWinners: [],
  error: null,
  errorCode: null,
  busy: false,
};

export type SessionAction =
  | { type: 'giveConsent' }
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
  | { type: 'toggleGarmentKept'; garmentId: string }
  | { type: 'toggleMakeupKept'; winner: MakeupChoice }
  | { type: 'failed'; message: string; code?: 'noFace' | 'general' }
  | { type: 'dismissError' }
  | { type: 'startOver' };

/** Inputs are complete when the user supplied the portrait, both garments, and one makeup look. */
export const inputsComplete = (state: SessionState): boolean =>
  state.portrait !== null &&
  state.garmentInputs.a !== null &&
  state.garmentInputs.b !== null &&
  state.makeupLookId !== null;

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'giveConsent':
      return { ...state, consentGiven: true };

    case 'goTo':
      return { ...state, step: action.step, error: null };

    case 'setPortrait':
      return {
        ...state,
        portrait: action.portrait,
        keptGarmentIds: [],
        keptMakeupWinners: [],
        error: null,
      };

    case 'clearPortrait':
      // One-tap delete, as promised on every screen showing the portrait. It clears the
      // analysis AND any kept options — they were derived from this face, so keeping
      // either would make the delete a gesture rather than a deletion.
      return {
        ...initialState,
        consentGiven: state.consentGiven,
        step: 'inputs',
      };

    case 'setGarmentInput': {
      const fixtureId = action.slot === 'a' ? 'rosewater-cardigan' : 'sage-linen-shirt';
      const otherId = action.slot === 'a'
        ? state.garmentIds[1] ?? 'sage-linen-shirt'
        : state.garmentIds[0] ?? 'rosewater-cardigan';
      return {
        ...state,
        garmentInputs: { ...state.garmentInputs, [action.slot]: action.image },
        garmentIds: action.slot === 'a' ? [fixtureId, otherId] : [otherId, fixtureId],
        keptGarmentIds: [],
        keptMakeupWinners: [],
        error: null,
      };
    }

    case 'clearGarmentInput':
      return {
        ...state,
        garmentInputs: { ...state.garmentInputs, [action.slot]: null },
        garmentIds: state.garmentIds.filter((_id, index) =>
          action.slot === 'a' ? index !== 0 : index !== 1,
        ),
        keptGarmentIds: [],
        keptMakeupWinners: [],
        error: null,
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
      return {
        ...state,
        makeupLookId: action.lookId,
        keptGarmentIds: [],
        keptMakeupWinners: [],
        error: null,
      };

    case 'analysisStarted':
      return { ...state, busy: true, error: null, step: 'generate' };

    case 'analysisReady':
      return { ...state, analysis: action.analysis };

    case 'tryOnReady':
      return { ...state, tryOn: action.tryOn, busy: false };

    case 'setAxis':
      return { ...state, axis: action.axis };

    case 'toggleGarmentKept': {
      const kept = state.keptGarmentIds.includes(action.garmentId);
      return {
        ...state,
        keptGarmentIds: kept
          ? state.keptGarmentIds.filter((garmentId) => garmentId !== action.garmentId)
          : [...state.keptGarmentIds, action.garmentId],
      };
    }

    case 'toggleMakeupKept': {
      const kept = state.keptMakeupWinners.includes(action.winner);
      return {
        ...state,
        keptMakeupWinners: kept
          ? state.keptMakeupWinners.filter((winner) => winner !== action.winner)
          : [...state.keptMakeupWinners, action.winner],
      };
    }

    case 'failed':
      return { ...state, error: action.message, errorCode: action.code ?? 'general', busy: false };

    case 'dismissError':
      return { ...state, error: null, errorCode: null };

    case 'startOver':
      // A new look starts a new comparison session. The photograph and kept options do
      // not cross that boundary.
      return {
        ...initialState,
        consentGiven: state.consentGiven,
      };

    default:
      return state;
  }
}
