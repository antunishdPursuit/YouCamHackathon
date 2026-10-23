import { Button } from '../components/controls.js';
import { DEMO_PORTRAIT_URL } from '../state/demoAssets.js';

/** Explicitly approved public demo inputs and saved results. */
export function DemoInputsScreen({ onGenerate, onBack }: { onGenerate: () => void; onBack: () => void }) {
  return <section className="space-y-6">
    <h1 className="font-display text-4xl">Your sample inputs</h1>
    <p>Champagne Halo makeup and two full-body outfits are selected. Generate opens saved examples without using credits.</p>
    <p className="text-sm text-ink-soft">These original demo photos are shared with permission. The two full-body outfits and matching portrait makeup are genuine saved captures. Compare makeup includes the earlier Rose Veil clip; Compare outfits includes a separate ivory blazer complete-look clip. Each video appears with its own captured source image.</p>
    <div className="grid gap-6 sm:grid-cols-3">
      {[
        ['Portrait', DEMO_PORTRAIT_URL, 'original demo source'],
        ['Garment A', '/fixtures/demo-garment-a.jpg', 'original garment reference'],
        ['Garment B', '/fixtures/demo-garment-b.jpg', 'original garment reference'],
      ].map(([label, url, provenance]) => <figure key={label} className="rounded-card bg-surface p-4">
        <img src={url} alt={`${label} — ${provenance}`} className="h-64 w-full object-contain" />
        <figcaption className="mt-3">{label} · {provenance}</figcaption>
      </figure>)}
    </div>
    <p>Makeup: <strong>Champagne Halo</strong></p>
    <div className="flex flex-wrap gap-4">
      <Button onClick={onGenerate}>Generate demo previews</Button>
      <Button variant="quiet" onClick={onBack}>Back to Start</Button>
    </div>
  </section>;
}
