# Project Ideas

**Status:** Internal options for discussion; none is approved scope  
**Research basis:** [[Brief and Rules]] and [[Track and API Research]]

## How to read these ideas

The event has one listed sponsor, Perfect Corp. Each idea uses a coherent group of APIs from the YouCam suite. The **MVP** column is the smallest defensible demo; the **stretch** column shows how to use more of the sponsor’s API families only after the core flow works.

## 1. Palette Passport

**Track:** Skin AI + Apparel VTO  
**User:** A shopper who wants a coordinated look before buying a product or outfit.  
**Core value:** Convert one selfie and one garment choice into a personalized, visual shopping decision.

### API plan

- **AI Facial Color Tones Analyzer:** Establish an appearance-oriented color palette.
- **AI Skin Analysis:** Add skin-focused context to the beauty side of the experience.
- **AI Clothes Virtual Try-On:** Preview one selected garment.
- **AI Makeup Virtual Try-On:** Preview one compatible makeup look or product.
- **Stretch: AI Hair Color Virtual Try-On and AI Earrings Virtual Try-On:** Complete the look with hair and accessory choices.

### User flow

1. Upload or take a consented portrait and select one clothing image.
2. Run the color and skin analysis.
3. Show a small palette with plain-language, non-medical appearance notes.
4. Preview one apparel result and one makeup result.
5. Let the user compare two coordinated options and save the preferred look card.

### MVP boundary

Use one portrait, one garment, one makeup option, and deterministic palette rules. Do not attempt an open-ended stylist agent, a product catalog crawler, or a full composite image in the first build.

### Why it fits the judging criteria

It connects the Skin and Apparel tracks into one purchase decision, uses more than one sponsor API for a clear reason, and can show a complete journey in a short demo. The value is easy to explain: fewer mismatched beauty and clothing choices.

### Risks and controls

- Do not claim that the API diagnoses a skin condition or prescribes treatment.
- Keep the palette explanation transparent and rule-based.
- If outputs cannot be layered reliably, show a coordinated result board rather than pretending the images are one physically accurate composite.
- Confirm the feature cost of each call before enabling the hair and earring extensions.

## 2. Capsule Cart

**Track:** Apparel Virtual Try-On  
**User:** An online shopper planning a small wardrobe or travel capsule.  
**Core value:** Compare a few pieces as a shoppable outfit board before purchase.

### API plan

- **AI Clothes Virtual Try-On:** Preview the main garment.
- **AI Shoes Virtual Try-On:** Add footwear to the comparison.
- **AI Bag Virtual Try-On:** Add a bag or clutch choice.
- **Stretch: AI Scarf, AI Hat, AI Necklace, or AI Earrings Virtual Try-On:** Add one accessory tier at a time.
- **Optional supporting API: AI Photo Background Removal:** Normalize product images before they enter the try-on flow.

### User flow

1. Upload a full-body or appropriate portrait and choose a small set of catalog images.
2. Run the main garment, footwear, and bag try-ons as separate result cards.
3. Ask the user to choose a use case such as commute, interview, or weekend travel.
4. Show a compact capsule board with the selected outfit and a simple “why this set” explanation based on the selected use case, not on unsupported body or fit claims.
5. Link each result card to the source catalog item in the demo data.

### MVP boundary

Use three result cards: clothes, shoes, and bag. Do not claim exact size or fit prediction. Do not layer every API result into one image until the individual outputs are stable.

### Why it fits the judging criteria

It has a direct retail problem, a clear Apparel VTO anchor, visible use of several fashion and accessory APIs, and a natural testing story. The demo can be judged from the result board even if one accessory endpoint is unavailable.

### Risks and controls

- Treat “try-on” as visual preview, not a guarantee of fit, sizing, or return reduction.
- Normalize image orientation and asset backgrounds before API calls.
- Keep the accessory set small because each result may consume units and adds latency.
- Maintain a fallback catalog card when an accessory call fails.

## 3. Skin-to-Shelf Routine

**Track:** Skin AI  
**User:** A shopper who wants a simple, visual way to explore a beauty routine without navigating a large product catalog.  
**Core value:** Connect skin-oriented insight to a small set of visible, user-controlled beauty choices.

### API plan

- **AI Skin Analysis:** Create the starting appearance insight.
- **AI Facial Color Tones Analyzer:** Produce a color context for product and makeup choices.
- **AI Makeup Virtual Try-On or AI Look Virtual Try-On:** Preview a selected look.
- **Stretch: AI Hair Color or AI Hair Style Virtual Try-On:** Extend the routine into a complete appearance choice.
- **Stretch: AI Nail Virtual Try-On or AI Earrings Virtual Try-On:** Add a small, visually distinct finishing option.
- **Optional, carefully framed: AI Skin Simulation:** Show a visual what-if only if the output and wording can be validated; do not present it as a guaranteed treatment result.

### User flow

1. Upload a consented portrait.
2. Run skin and color analysis.
3. Translate the result into a small, static demo catalog with clear labels such as “color family” or “look direction.”
4. Preview one makeup choice and one optional hair or accessory choice.
5. Show the selected routine as a shareable result card with a non-medical disclaimer and a link to each demo product.

### MVP boundary

Use Skin Analysis, Facial Color Tones, and one Makeup VTO result. Keep recommendations rule-based and limited to the demo catalog. Do not provide medical, dermatological, or treatment advice.

### Why it fits the judging criteria

It has a direct Skin AI story, demonstrates several sponsor APIs without requiring a large commerce backend, and can be made coherent through a single “choose a look” journey.

### Risks and controls

- Avoid diagnostic language, health claims, or claims that a product will improve a condition.
- Do not infer identity, age, race, or sensitive traits beyond what the selected API explicitly returns and the product needs.
- Treat optional simulation as a stretch feature, not the main promise.
- Keep uploaded images temporary and explain the processing flow in the UI.

## Comparison

| Idea | Track coverage | Core APIs | Build risk | Retail clarity | Best reason to choose |
|---|---|---:|---|---|---|
| Palette Passport | Combined | 4 | Medium | High | Strongest cross-track story and broad sponsor coverage. |
| Capsule Cart | Apparel | 3 | Low-Medium | Very high | Fastest path to a visible retail demo. |
| Skin-to-Shelf Routine | Skin | 3 | Medium | High | Strongest focused Skin AI narrative with a small backend. |

## Working recommendation

Start with **Palette Passport** only if the three-call smoke test works and the API unit cost is acceptable. Otherwise choose **Capsule Cart** for the shortest reliable path to a polished demo. Keep **Skin-to-Shelf Routine** as the safer fallback if apparel image requirements or composition create friction.

This recommendation is planning guidance, not an approved project decision.
