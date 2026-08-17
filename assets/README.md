# Assets

There are two kinds of image in YINCOL and they must never be confused.

**SOURCE** images are shot or licensed by the team and fed *into* the API.
**RESULT** images come *out* of the API and are produced only by the capture script.

A result image is never hand-supplied. If a picture in `web/public/fixtures/` did not come
from `npm run capture-fixtures`, it is not a result — it is a mock-up, and presenting it as
an API output would be dishonest.

---

## SOURCE — three images, supplied by the team

These live in `assets/source/`, which is **gitignored**. They are read by the capture
script and never committed. The current documented Makeup VTO endpoint does not take a
makeup reference image; it takes an effects configuration. Do not add a makeup reference
file unless a separate provider endpoint is verified and approved.

| File | What it must be |
| --- | --- |
| `assets/source/portrait.jpg` | Bare-face selfie. Upper body clearly visible, one person, plain uncluttered background, even front lighting, no makeup. This is the face every preview is generated from. |
| `assets/source/garment-a.jpg` | Garment product image — flat-lay or on-model, full garment in frame, plain background. |
| `assets/source/garment-b.jpg` | Second garment, shot the same way. Pick something that genuinely differs in colour from A, otherwise the comparison screen has nothing to show. |

The makeup choice is currently represented by a documented `effects` configuration in the
Makeup VTO request, not by a fourth image.

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

## RESULT — three images, generated

`npm run capture-fixtures` runs live tasks against the API and writes the returned bytes
into `web/public/fixtures/`:

| Fixture | Produced by |
| --- | --- |
| `garment-a-result.jpg` | Clothes virtual try-on, portrait + garment A |
| `garment-b-result.jpg` | Clothes virtual try-on, portrait + garment B |
| `makeup-on-result.jpg` | Makeup virtual try-on, portrait + documented effects configuration |

The script downloads the bytes **immediately** after each task succeeds. The download URL
the API returns is valid for two hours only, so a fixture may never store a URL — only
bytes committed to the repo survive to demo day.

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
not a broken image. Nothing here blocks development, and the whole nine-screen flow is
demonstrable before a single source photograph exists.
