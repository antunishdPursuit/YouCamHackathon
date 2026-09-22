# Assets

Keep source inputs, captured provider results, and labelled placeholders separate.
Reference or design mock images must never be described as YouCam results.

**SOURCE** images are approved inputs with permission for this use.
**CAPTURED RESULT** means bytes returned by a successful YouCam task, downloaded
with evidence of their source and output. The standard image batch uses
`npm run capture-fixtures`; the bounded video and private full-body captures below
used separate approved procedures. File presence alone does not establish provenance.
**PLACEHOLDER** means a designed stand-in, never a generated provider result.

原始输入、真实 API 结果与占位图必须分开。设计参考图不能称为 YouCam 结果。
真实结果必须来自成功的接口任务，并保留来源记录；仅有一个图片文件不能证明其来源。
运行与交接请参阅[中英双语指南](../docs/partner-guide.md)。

---

## SOURCE — standard image capture inputs

These live in `assets/source/`, which is **gitignored**. They are read by the capture
script and never committed. The current documented Makeup VTO endpoint does not take a
makeup reference image; it takes an effects configuration. Do not add a makeup reference
file unless a separate provider endpoint is verified and approved.

| File | What it must be |
| --- | --- |
| `assets/source/portrait.png` | Bare-face portrait. Upper body clearly visible, one person, plain uncluttered background, even front lighting. Used by the standard close-up capture. |
| `assets/source/garment-a.jpg` | Garment product image — flat-lay or on-model, full garment in frame, plain background. |
| `assets/source/garment-b.jpg` | Second garment, shot the same way. Pick something that genuinely differs in colour from A, otherwise the comparison screen has nothing to show. |

The makeup choice is an `effects` configuration in the Makeup VTO request, not a
makeup reference image. Optional full-body generation also requires a full-body
portrait of the same person and a trousers reference with the target garment visible.
These additional private inputs are not included in the standard three-file capture.

### Specs — feature-specific

All source files must be JPEG or PNG, under 10 MB, with a long side no greater than
4096px. Clothes VTO and Makeup VTO add feature-specific framing rules, so validate each
image against the selected endpoint before spending a unit.

For the portrait, use one person with the full face visible, a forward-facing pose, and
an uncluttered background. For garment references, use a single product image or a
single-person outfit reference with the target area visible and unobstructed. The official
Clothes VTO page recommends 1024×768 and allows a minimum of 512×384; the official Makeup
VTO page has separate face-size and frontal-face requirements.

The browser and server validate file type and the shared size ceiling before submitting
the opt-in live path and show a friendly message on failure. Clothes VTO and Makeup VTO
still enforce their own framing and face-position rules, so the provider remains the
final authority for feature-specific image suitability.

---

## RESULT — four images, generated

`npm run capture-fixtures` runs live tasks against the API and writes the returned bytes
into `web/public/fixtures/`. Each garment produces two, because the live path produces
two: the garment task's own output, and that output after the makeup task rendered the
configured effects onto it.

| Fixture | Produced by |
| --- | --- |
| `garment-a-result.jpg` | Clothes virtual try-on, portrait + garment A |
| `complete-look-a-result.jpg` | Makeup virtual try-on, applied to `garment-a-result.jpg` |
| `garment-b-result.jpg` | Clothes virtual try-on, portrait + garment B |
| `complete-look-b-result.jpg` | Makeup virtual try-on, applied to `garment-b-result.jpg` |

The complete-look fixtures use one makeup look (`rose-veil`). Capturing every look against
every garment would multiply the credit cost for no demo benefit; any other look in the
picker falls back to the designed placeholder, which says so on its face.

The script runs the same sequence the browser route runs, and downloads the bytes
**immediately** after each task succeeds — it has to, since the makeup task's input is the
garment task's downloaded image. The download URL the API returns is valid for two hours
only, so a fixture may never store a URL; only bytes committed to the repo survive to demo
day.

---

## Likeness rights — read before shooting

Face images carry likeness rights. Any portrait or on-model garment reference used here
**must** be a team member's own photo, or an image you hold a licence for that explicitly
permits this use. Do not pull a face off a search engine, a stock site's watermarked
preview, a social media account, or a dataset of unclear provenance.

This is why `assets/source/` is gitignored: the repository is shared, and a face committed
once stays in git history forever.

---

## Running without any of this

The app runs fully on ornamental placeholders. Every empty image slot renders a designed
cream panel with a gold hairline frame and a quiet caption — an intentional empty state,
not a broken image. Nothing here blocks development, and the whole four-stage flow —
Start, Add inputs, Generate, Results — is demonstrable before a single source photograph
exists.

## Local motion sample — September 20, 2026

`web/public/fixtures/garment-a-motion-sample.mp4` is a captured YouCam Image to
Video V2 result generated from `complete-look-a-result.jpg`. One five-second,
720p task was approved, submitted once, and downloaded immediately after
success. The output is 720 × 896 and its encoded duration is 5.0625 seconds.
Documented cost is 10 units; the billed balance was not separately checked.
The source/output hashes, request, and redacted result shape are recorded in
`docs/captured-shapes/garment-a-motion-sample.json`. This was a separate bounded
capture, not a change to the ordinary fixture-generation or browser API flow.

The Garments comparison offers playback only for the matching captured
red-shirt complete-look fixture. It never substitutes the clip for a live
visitor result, another makeup preset, or a placeholder. The original still
remains available. Expressions and fine details can change in generated motion;
the video does not establish garment fit and is not a rotatable 3D model.
Garment B remains a still. The release does not include a 3D model or reconstruction.

## Private full-body captures — September 21, 2026

The separately approved full-body batch produced two complete looks using the
original full-body portrait, a worn cream-trouser reference, the red/blue top
references, and Champagne Halo makeup. Clothes VTO applied the trousers once,
then each top independently; Makeup VTO received each clothed result. All five
tasks succeeded with no generation retries. Expected usage was 8 units; the
billing balance was not checked. The final PNGs are 1002 × 1568 pixels.

These captured bytes and their private evidence are kept in ignored
`assets/private-results/full-body/`, separate from source inputs and public
fixtures. These are private test evidence; no captures, manifests, or
intermediate files are served or substituted for a visitor's results.
This batch used a bounded local capture script, rather than the normal
fixture script, to preserve existing head-and-shoulders captures and skip skin
analysis. Both final images were visually reviewed for outfit changes and
uncropped framing. Fine facial and clothing details remain AI interpretations.
