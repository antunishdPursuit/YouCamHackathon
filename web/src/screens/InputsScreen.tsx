/**
 * Stage 2 — Add inputs.
 *
 * One place for the portrait, the two garment references, and the makeup direction.
 * The file inputs stay in the browser. Fixture mode still uses fixture ids for garment
 * generation, while opt-in live mode sends the selected bytes through the verified
 * provider paths; this screen keeps that boundary visible.
 */

import { useRef, useState } from 'react';
import { checkImageDimensions, IMAGE_SPEC, MAKEUP_LOOKS, type ImageCheck } from '@yincol/shared';
import { Button } from '../components/controls.js';
import { GildedFrame, PearlDivider, Ribbon, SectionHeading, YincolCard } from '../components/ornament.js';
import {
  OCCASION_LABELS,
  OCCASION_OPTIONS,
  SETTING_LABELS,
  SETTING_OPTIONS,
  type CapturedImage,
  type CapturedPortrait,
  type Occasion,
  type Setting,
} from '../state/session.js';

type InputSlot = 'portrait' | 'garmentA' | 'garmentB';

const SLOT_COPY: Record<
  InputSlot,
  { title: string; description: string; emptyAlt: string; acceptLabel: string }
> = {
  portrait: {
    title: 'Portrait',
    description: 'One person, face-on, with the face clearly visible and evenly lit. On a phone, your file picker may also offer the camera.',
    emptyAlt: 'No portrait selected',
    acceptLabel: 'Choose portrait',
  },
  garmentA: {
    title: 'Garment A',
    description: 'One garment reference with most of the item visible.',
    emptyAlt: 'No first garment selected',
    acceptLabel: 'Choose garment A',
  },
  garmentB: {
    title: 'Garment B',
    description: 'A second garment reference to compare with the first.',
    emptyAlt: 'No second garment selected',
    acceptLabel: 'Choose garment B',
  },
};

function InputPreview({ image, alt }: { image: CapturedImage; alt: string }) {
  return (
    <div className="overflow-hidden rounded-card border border-gold/50 bg-ground">
      <img src={image.previewUrl} alt={alt} className="block aspect-[4/3] h-auto w-full object-cover" />
    </div>
  );
}

function ImagePickerCard({
  slot,
  image,
  onChange,
  onClear,
}: {
  slot: InputSlot;
  image: CapturedImage | null;
  onChange: (image: CapturedImage) => void;
  onClear?: () => void;
}) {
  const [check, setCheck] = useState<ImageCheck | null>(null);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const copy = SLOT_COPY[slot];

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setCheck({
        code: 'unsupportedType',
        usable: false,
        message: 'Please choose a JPEG or PNG image.',
      });
      return;
    }

    if (file.size >= IMAGE_SPEC.maxFileBytesExclusive) {
      setCheck({
        code: 'fileTooLarge',
        usable: false,
        message: 'That file is too large. Please choose an image smaller than 10 MB.',
      });
      return;
    }

    setReading(true);
    const previewUrl = URL.createObjectURL(file);
    const imageElement = new Image();

    imageElement.onload = () => {
      const verdict = checkImageDimensions(imageElement.naturalWidth, imageElement.naturalHeight);
      setCheck(verdict);
      setReading(false);

      if (!verdict.usable) {
        URL.revokeObjectURL(previewUrl);
        return;
      }

      onChange({
        previewUrl,
        file,
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight,
        ...(verdict.code === 'belowHd' ? { note: verdict.message } : {}),
      });
    };

    imageElement.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      setReading(false);
      setCheck({
        code: 'tooSmall',
        usable: false,
        message: 'That file could not be read as an image. Please try another.',
      });
    };

    imageElement.src = previewUrl;
  };

  return (
    <GildedFrame as="article" className="flex h-full flex-col bg-surface p-4 sm:p-5">
      <div>
        {image ? (
          <div className="relative">
            <InputPreview image={image} alt={`Selected ${copy.title.toLowerCase()}`} />
            <div className="absolute right-3 top-3">
              <Ribbon label="Added" />
            </div>
          </div>
        ) : (
          <div
            className="flex aspect-[4/3] flex-col items-center justify-center rounded-card border border-dashed border-gold/60 bg-ground px-5 text-center"
            role="img"
            aria-label={copy.emptyAlt}
          >
            <svg viewBox="0 0 60 60" aria-hidden="true" className="h-12 w-12 text-gold">
              <path
                d="M 14 46 L 14 22 a 16 16 0 0 1 32 0 L 46 46 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="30" cy="18" r="2.4" fill="currentColor" opacity="0.6" />
            </svg>
            <p className="mt-2 font-display text-xl text-ink">{copy.title}</p>
            <p className="mt-2 max-w-[28ch] text-sm text-ink-soft">{copy.description}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        <Button className="!px-4 text-sm" onClick={() => fileInput.current?.click()}>
          {image ? 'Replace' : copy.acceptLabel}
        </Button>
        {image && onClear ? (
          <Button variant="link" className="text-sm" onClick={onClear}>
            Remove
          </Button>
        ) : null}
      </div>

      <div aria-live="polite" className="mt-3 min-h-[1.5rem]">
        {reading ? <p className="text-xs text-ink-soft">Checking image size…</p> : null}
        {check && !reading ? (
          <p className={`text-xs ${check.usable ? 'text-ink-soft' : 'text-ink'}`}>
            {check.usable && check.code === 'ok' ? 'Image size looks good.' : check.message}
          </p>
        ) : null}
        {image?.note ? <p className="text-xs text-ink-soft">{image.note}</p> : null}
      </div>
    </GildedFrame>
  );
}

export function InputsScreen({
  occasion,
  setting,
  portrait,
  garmentInputs,
  makeupLookId,
  demoInputs,
  onOccasion,
  onSetting,
  onPortrait,
  onGarment,
  onClearGarment,
  onChooseMakeup,
  onUseDemo,
  onContinue,
  onBack,
}: {
  occasion: Occasion | null;
  setting: Setting | null;
  portrait: CapturedPortrait | null;
  garmentInputs: { readonly a: CapturedImage | null; readonly b: CapturedImage | null };
  makeupLookId: string | null;
  demoInputs: boolean;
  onOccasion: (occasion: Occasion) => void;
  onSetting: (setting: Setting | null) => void;
  onPortrait: (image: CapturedPortrait) => void;
  onGarment: (slot: 'a' | 'b', image: CapturedImage) => void;
  onClearGarment: (slot: 'a' | 'b') => void;
  onChooseMakeup: (lookId: string) => void;
  onUseDemo: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const ready =
    occasion !== null &&
    (demoInputs || (portrait !== null && garmentInputs.a !== null && garmentInputs.b !== null && makeupLookId !== null));

  return (
    <div className="animate-soft-fade space-y-10">
      <header className="text-center">
        <SectionHeading>Add your inputs</SectionHeading>
        <p className="mx-auto mt-3 text-lg text-ink-soft">
          Add one portrait, two garment references, and the makeup direction you want to compare.
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(240px,0.34fr)_minmax(0,1fr)] xl:items-start">
        <YincolCard aria-labelledby="occasion-heading" tone="surface" className="p-6 sm:p-7">
          <h3 id="occasion-heading" className="font-display text-2xl text-ink">
            What are you dressing for?
          </h3>
          <p className="mt-2 text-base text-ink-soft">
            Choose the moment you have in mind so the comparison stays focused. This context stays in this tab and is not sent to YouCam.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label="Occasion">
            {OCCASION_OPTIONS.map((option) => {
              const selected = occasion === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onOccasion(option)}
                  className={`min-h-[44px] rounded-full border px-3 py-2 text-sm font-semibold transition-shadow duration-200 ${
                    selected ? 'border-gold bg-powder text-ink shadow-emboss' : 'border-gold/50 bg-ground text-ink'
                  }`}
                >
                  {OCCASION_LABELS[option]}
                </button>
              );
            })}
          </div>
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-ink">Setting <span className="font-normal text-ink-soft">(optional)</span></legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {SETTING_OPTIONS.map((option) => {
                const selected = setting === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSetting(selected ? null : option)}
                    className={`min-h-[44px] rounded-full border px-4 py-2 text-sm transition-shadow duration-200 ${
                      selected ? 'border-gold bg-powder text-ink shadow-emboss' : 'border-gold/50 bg-ground text-ink'
                    }`}
                  >
                    {SETTING_LABELS[option]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </YincolCard>

        <section aria-label="Portrait and garment inputs">
          <div className="grid gap-5 lg:grid-cols-3">
            <ImagePickerCard
              slot="portrait"
              image={portrait}
              onChange={onPortrait}
            />
            <ImagePickerCard
              slot="garmentA"
              image={garmentInputs.a}
              onChange={(image) => onGarment('a', image)}
              onClear={() => onClearGarment('a')}
            />
            <ImagePickerCard
              slot="garmentB"
              image={garmentInputs.b}
              onChange={(image) => onGarment('b', image)}
              onClear={() => onClearGarment('b')}
            />
          </div>
          <p className="mt-4 rounded-card border border-gold/40 bg-surface px-4 py-3 text-sm text-ink-soft">
            Uploads stay in this tab. The local demo uses fixture previews by default. Opt-in
            live mode sends the portrait and garment files through the verified Clothes VTO,
            Makeup VTO, and Skin Analysis paths without saving them. The colour direction
            remains a local guide until Facial Color Tone is verified.
          </p>
        </section>
      </div>

      <PearlDivider />

      <section aria-labelledby="makeup-input-heading">
        <h3 id="makeup-input-heading" className="font-display text-2xl text-ink">
          Makeup direction
        </h3>
        <p className="mt-2 text-base text-ink-soft">
          Choose a YINCOL preset to send to the Makeup API, or use the local demo inputs.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MAKEUP_LOOKS.map((look) => {
            const selected = !demoInputs && look.id === makeupLookId;
            return (
              <button
                key={look.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChooseMakeup(look.id)}
                className={`rounded-card border p-4 text-left transition-shadow duration-200 ${
                  selected ? 'border-gold bg-powder shadow-emboss' : 'border-gold/50 bg-ground'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-display text-xl text-ink">{look.name}</span>
                  {selected ? <Ribbon label="Selected" /> : null}
                </span>
                <span className="mt-2 block text-sm text-ink-soft">{look.description}</span>
                <span className="mt-4 flex gap-3" aria-label={`${look.name} colour chips`}>
                  {(['lip', 'cheek', 'eye'] as const).map((zone) => (
                    <span key={zone} className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 rounded-full border border-gold/50"
                        style={{ backgroundColor: look.chips[zone].hex }}
                      />
                      <span className="sr-only">{zone}: {look.chips[zone].name}</span>
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={demoInputs}
            onClick={onUseDemo}
            className={`rounded-card border p-4 text-left transition-shadow duration-200 ${
              demoInputs ? 'border-gold bg-powder shadow-emboss' : 'border-gold/50 bg-ground'
            }`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="font-display text-xl text-ink">Demo inputs</span>
              {demoInputs ? <Ribbon label="Selected" /> : null}
            </span>
            <span className="mt-2 block text-sm text-ink-soft">
              Use the local portrait, garment references, and Rose Veil look to walk through the flow.
            </span>
            <span className="mt-3 block text-xs text-ink-soft">No file selection or API credits.</span>
          </button>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="quiet" className="w-full sm:w-auto" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {!ready ? (
            <p className="text-sm text-ink-soft">
              Select an occasion and add all inputs to continue.
            </p>
          ) : null}
          <Button className="w-full !px-4 text-sm sm:w-auto" disabled={!ready} onClick={onContinue}>
            Generate previews
          </Button>
        </div>
      </div>
    </div>
  );
}
