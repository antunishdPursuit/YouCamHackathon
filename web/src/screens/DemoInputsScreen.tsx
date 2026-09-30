import { Button } from '../components/controls.js';

/** Shipped examples only. Private source photographs are intentionally not published. */
export function DemoInputsScreen({ onGenerate, onBack }: { onGenerate: () => void; onBack: () => void }) {
  return <section className="space-y-6">
    <h1 className="font-display text-4xl">Your sample inputs</h1>
    <p>Rose Veil makeup and two sample garments are selected. Generate opens saved examples without using credits.</p>
    <p className="text-sm text-ink-soft">Original source photos are not published. The input illustrations below are labelled stand-ins. Full-body and original-portrait makeup captures are still unavailable.</p>
    <div className="grid gap-6 sm:grid-cols-3">
      {[
        ['Portrait', 'placeholder-portrait.svg'],
        ['Garment A', 'placeholder-garment-a.svg'],
        ['Garment B', 'placeholder-garment-b.svg'],
      ].map(([label, file]) => <figure key={label} className="rounded-card bg-surface p-4">
        <img src={`/fixtures/${file}`} alt={`${label} — illustrated stand-in`} className="h-64 w-full object-contain" />
        <figcaption className="mt-3">{label} · illustrated stand-in</figcaption>
      </figure>)}
    </div>
    <p>Makeup: <strong>Rose Veil</strong></p>
    <div className="flex flex-wrap gap-4">
      <Button onClick={onGenerate}>Generate demo previews</Button>
      <Button variant="quiet" onClick={onBack}>Back to Start</Button>
    </div>
  </section>;
}
