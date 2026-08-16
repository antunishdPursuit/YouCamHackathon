/**
 * The session state machine.
 *
 * One reducer, one shape. There is no database and no account — everything here lives
 * in memory for the length of one visit and is thrown away when the tab closes, which
 * is exactly what the consent panel promises.
 */

import type { AnalyzeResponse, TryOnResponse } from '@yincol/shared';

export type Step =
  | 'intro'
  | 'capture'
  | 'selection'
  | 'analysis'
  | 'colors'
  | 'preview'
  | 'compare'
  | 'lookCard';

/** The order screens advance in, used for the back affordance. */
export const STEP_ORDER: readonly Step[] = [
  'intro',
  'capture',
  'selection',
  'analysis',
  'colors',
  'preview',
  'compare',
  'lookCard',
];

export interface CapturedPortrait {
  /** An object URL for the chosen file, revoked when the portrait is replaced or cleared. */
  readonly previewUrl: string;
  /** The selected bytes stay in memory until this session ends; they are never persisted. */
  readonly file: File;
  readonly width: number;
  readonly height: number;
  readonly note?: string;
}

/** Which axis the compare screen is showing. */
export type CompareAxis = 'garments' | 'makeup';

/**
 * A look the shopper kept, held in memory only.
 *
 * There is no database, so "saved" means "for as long as this tab is open" — which is
 * exactly what the consent panel promises, and why the empty state is the honest
 * default rather than a bug.
 */
export interface SavedLook {
  readonly id: string;
  readonly garmentName: string;
  readonly makeupName: string;
  readonly swatchHexes: readonly string[];
  readonly summary: string;
}

export interface SessionState {
  readonly step: Step;
  readonly consentGiven: boolean;
  readonly portrait: CapturedPortrait | null;
  /** Exactly two, once selection is complete. */
  readonly garmentIds: readonly string[];
  readonly makeupLookId: string | null;
  readonly analysis: AnalyzeResponse | null;
  readonly tryOn: TryOnResponse | null;
  readonly axis: CompareAxis;
  /** One winner per axis, chosen by tapping a panel. */
  readonly garmentWinnerId: string | null;
  readonly makeupWinner: 'bare' | 'madeUp' | null;
  readonly savedLook: boolean;
  readonly savedLooks: readonly SavedLook[];
  readonly error: string | null;
  /** Distinguishes "no face" from a generic failure, so the copy can differ. */
  readonly errorCode: 'noFace' | 'general' | null;
  readonly busy: boolean;
}

export const initialState: SessionState = {
  step: 'intro',
  consentGiven: false,
  portrait: null,
  garmentIds: [],
  makeupLookId: null,
  analysis: null,
  tryOn: null,
  axis: 'garments',
  garmentWinnerId: null,
  makeupWinner: null,
  savedLook: false,
  savedLooks: [],
  error: null,
  errorCode: null,
  busy: false,
};

export type SessionAction =
  | { type: 'giveConsent' }
  | { type: 'goTo'; step: Step }
  | { type: 'setPortrait'; portrait: CapturedPortrait }
  | { type: 'clearPortrait' }
  | { type: 'toggleGarment'; garmentId: string }
  | { type: 'chooseMakeup'; lookId: string }
  | { type: 'analysisStarted' }
  | { type: 'analysisReady'; analysis: AnalyzeResponse }
  | { type: 'tryOnReady'; tryOn: TryOnResponse }
  | { type: 'setAxis'; axis: CompareAxis }
  | { type: 'pickGarmentWinner'; garmentId: string }
  | { type: 'pickMakeupWinner'; winner: 'bare' | 'madeUp' }
  | { type: 'saveLook'; look: SavedLook }
  | { type: 'failed'; message: string; code?: 'noFace' | 'general' }
  | { type: 'dismissError' }
  | { type: 'startOver' };

/** Selection is complete at exactly two garments and one makeup look. */
export const selectionComplete = (state: SessionState): boolean =>
  state.garmentIds.length === 2 && state.makeupLookId !== null;

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'giveConsent':
      return { ...state, consentGiven: true };

    case 'goTo':
      return { ...state, step: action.step, error: null };

    case 'setPortrait':
      return { ...state, portrait: action.portrait, error: null };

    case 'clearPortrait':
      // One-tap delete, as promised on every screen showing the portrait. It clears the
      // analysis AND any kept looks — a look card carries a portrait thumbnail and a
      // palette read from that face, so keeping either would make the delete a gesture
      // rather than a deletion.
      return {
        ...initialState,
        consentGiven: state.consentGiven,
        step: 'capture',
      };

    case 'toggleGarment': {
      const already = state.garmentIds.includes(action.garmentId);
      if (already) {
        return { ...state, garmentIds: state.garmentIds.filter((id) => id !== action.garmentId) };
      }
      // Two is the limit. A third tap replaces the older of the two rather than being
      // silently ignored, so the control never feels dead.
      const next =
        state.garmentIds.length < 2
          ? [...state.garmentIds, action.garmentId]
          : [state.garmentIds[1]!, action.garmentId];
      return { ...state, garmentIds: next };
    }

    case 'chooseMakeup':
      return { ...state, makeupLookId: action.lookId };

    case 'analysisStarted':
      return { ...state, busy: true, error: null, step: 'analysis' };

    case 'analysisReady':
      return { ...state, analysis: action.analysis };

    case 'tryOnReady':
      return { ...state, tryOn: action.tryOn, busy: false };

    case 'setAxis':
      return { ...state, axis: action.axis };

    case 'pickGarmentWinner':
      return { ...state, garmentWinnerId: action.garmentId };

    case 'pickMakeupWinner':
      return { ...state, makeupWinner: action.winner };

    case 'saveLook': {
      // Re-saving the same combination replaces it rather than stacking duplicates.
      const others = state.savedLooks.filter((look) => look.id !== action.look.id);
      return {
        ...state,
        savedLook: true,
        savedLooks: [...others, action.look],
        step: 'lookCard',
      };
    }

    case 'failed':
      return { ...state, error: action.message, errorCode: action.code ?? 'general', busy: false };

    case 'dismissError':
      return { ...state, error: null, errorCode: null };

    case 'startOver':
      // Kept looks survive starting over — they are the one thing the shopper chose to
      // hold on to. The photograph does not.
      return {
        ...initialState,
        consentGiven: state.consentGiven,
        savedLooks: state.savedLooks,
      };

    default:
      return state;
  }
}
