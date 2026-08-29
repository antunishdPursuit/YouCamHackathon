/**
 * Every sentence the app says about where the shopper's photograph goes.
 *
 * They live together because they must agree. Four screens made the same promise in four
 * slightly different wordings, which is exactly how one of them survives a behaviour
 * change that falsifies it. Auditing the claim now means reading one file.
 *
 * The claim is true in fixture mode because of what `api/client.ts` does — it never reads
 * the file — and not because of anything written here. If that changes, these change.
 *
 * `null` means the server has not said which mode it is in yet. Each sentence then falls
 * back to what is true either way, which is usually less than we would like to say.
 */

/** The persistent privacy bar, on every screen showing the portrait. */
export function privacyBarSentence(imagesLeaveTab: boolean | null): string {
  if (imagesLeaveTab === null) return 'No account, no database.';
  if (imagesLeaveTab) {
    return 'Your photograph is sent to the preview service to generate your results. No account, no database.';
  }
  return 'Your photograph stays in this tab. No account, no database.';
}

/** Under the upload slots, where the shopper is deciding whether to hand a file over. */
export function uploadsSentence(imagesLeaveTab: boolean | null): string {
  const provenance =
    'The results screen will tell you whether each preview is a live YouCam result or a local fixture.';

  if (imagesLeaveTab === null) return provenance;
  if (imagesLeaveTab) {
    return `Your uploads are sent to the preview service to generate your results. ${provenance}`;
  }
  return `Your uploads stay in this tab. ${provenance}`;
}

/** While the previews are being produced, which is when the question feels most live. */
export function duringGenerationSentence(imagesLeaveTab: boolean | null): string {
  if (imagesLeaveTab === null) return 'The preview work is running.';
  if (imagesLeaveTab) return 'Your files are being sent to the preview service to generate results.';
  return 'Your files stay in this tab while the preview work runs.';
}

/** The "Where it is stored" row of the intro's plain-language privacy table. */
export function storageSentence(imagesLeaveTab: boolean | null): string {
  const local =
    'In this browser tab only, for as long as it stays open. There is no account and no database. Closing the tab ends it.';

  if (imagesLeaveTab === null) return local;
  if (imagesLeaveTab) {
    return (
      'In this browser tab, and sent to the preview service each time you generate results. ' +
      'There is no account and no database here. Closing the tab ends what this app holds.'
    );
  }
  return local;
}
