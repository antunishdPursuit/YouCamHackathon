# Assets

There are two kinds of image in YINCOL and they must never be confused.

**SOURCE** images are shot or licensed by the team and fed *into* the API.
**RESULT** images come *out* of the API and are produced only by the capture script.

A result image is never hand-supplied. If a picture in `web/public/fixtures/` did not come
from `npm run capture-fixtures`, it is not a result — it is a mock-up, and presenting it as
an API output would be dishonest.

---

## SOURCE — four images, supplied by the team

These live in `assets/source/`, which is **gitignored**. They are read by the capture
script and never committed.

| File | What it must be |
| --- | --- |
| `assets/source/portrait.jpg` | Bare-face selfie. Upper body clearly visible, one person, plain uncluttered background, even front lighting, no makeup. This is the face every preview is generated from. |
| `assets/source/garment-a.jpg` | Garment product image — flat-lay or on-model, full garment in frame, plain background. |
| `assets/source/garment-b.jpg` | Second garment, shot the same way. Pick something that genuinely differs in colour from A, otherwise the comparison screen has nothing to show. |
| `assets/source/makeup-reference.jpg` | A face **wearing the makeup look to transfer**. Not a swatch, not a product shot, not a colour chip — the API extracts the look from a made-up face. |

### Specs — all four

- Long side ≤ 4096px.
- Short side ≥ 480px (SD) or ≥ 1080px (HD). **Shoot for ≥ 1080px.**
- One person only.
- Uncluttered background.
- JPEG or PNG.

The app validates these client-side before submitting and shows a friendly message on
failure, so a wrong-sized image degrades gracefully rather than burning an API call.

---

## RESULT — three images, generated

`npm run capture-fixtures` runs live tasks against the API and writes the returned bytes
into `web/public/fixtures/`:

| Fixture | Produced by |
| --- | --- |
| `garment-a-result.jpg` | Clothes virtual try-on, portrait + garment A |
| `garment-b-result.jpg` | Clothes virtual try-on, portrait + garment B |
| `makeup-on-result.jpg` | Makeup transfer, portrait + makeup reference |

The script downloads the bytes **immediately** after each task succeeds. The download URL
the API returns is valid for two hours only, so a fixture may never store a URL — only
bytes committed to the repo survive to demo day.

---

## Likeness rights — read before shooting

Face images carry likeness rights. Any portrait or makeup reference used here **must** be
a team member's own photo, or an image you hold a licence for that explicitly permits this
use. Do not pull a face off a search engine, a stock site's watermarked preview, a social
media account, or a dataset of unclear provenance.

This is why `assets/source/` is gitignored: the repository is shared, and a face committed
once stays in git history forever.

---

## Running without any of this

The app runs fully on ornamental placeholders. Every empty image slot renders a designed
cream panel with a gold hairline frame and a quiet caption — an intentional empty state,
not a broken image. Nothing here blocks development, and the whole nine-screen flow is
demonstrable before a single photograph exists.
