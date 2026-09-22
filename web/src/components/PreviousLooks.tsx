import { useEffect, useState } from 'react';
import type { TryOnResponse } from '@yincol/shared';
import { findMakeupLook } from '@yincol/shared';
import { Button } from './controls.js';
import { YincolCard } from './ornament.js';
import { currentMediaLinks, mediaFileName, openSavedLook, type SavedLook, type OpenedLook } from '../state/savedLooks.js';

function LookThumbnail({ look }: { look: SavedLook }) {
  const [url, setUrl] = useState<string>();
  const first = Object.values(look.tryOn.completeLooks).find(panel => panel.result.status === 'ready');
  const imageId = first?.result.status === 'ready' ? first.result.imageUrl.replace(/^saved:/, '') : undefined;
  const media = look.media.find(item => item.id === imageId) ?? look.media.find(item => item.kind === 'image');
  useEffect(() => {
    if (!media) return;
    const next = URL.createObjectURL(media.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [media]);
  return url ? <img src={url} alt="" className="h-24 w-20 shrink-0 rounded-card bg-surface object-contain" /> : null;
}

export function PreviousLooks({ looks, loading, error, pending, onOpen, onDelete, onRetry, className = '' }: {
  looks: readonly SavedLook[];
  loading: boolean;
  error: string | null;
  pending: boolean;
  onOpen: (key: string) => void;
  onDelete: (key: string) => void;
  onRetry: () => void;
  className?: string;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  return <YincolCard aria-labelledby="history-heading" className={`p-6 ${className}`}>
    <h2 id="history-heading" className="font-display text-2xl text-ink">Previous looks</h2>
    <p className="mt-3 text-sm text-ink-soft">Saved automatically on this browser. Open a look without generating again.</p>
    {loading ? <p role="status" className="mt-4 text-sm">Opening your saved looks…</p> : null}
    {error ? <div role="alert" className="mt-4 space-y-2 text-sm"><p>{error}</p>
      <Button variant="quiet" onClick={onRetry} disabled={pending}>Retry loading</Button></div> : null}
    {!loading && !error && looks.length === 0 ? <p className="mt-6 text-sm text-ink-soft">No saved looks yet. Completed previews will appear here.</p> : null}
    <ul className="mt-4 space-y-4">
      {looks.map(look => <li key={look.key} className="space-y-3 rounded-card border border-gold/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <LookThumbnail look={look} />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">{findMakeupLook(look.makeupLookId ?? '')?.name ?? 'Saved comparison'}</h3>
            <p className="mt-1 text-sm text-ink-soft">{look.tryOn.mode === 'fixture' ? 'Saved demo' : 'Your generated previews'}{look.tryOn.fullBody ? ' · Full body included' : ''}</p>
            <time className="mt-1 block text-xs text-ink-soft" dateTime={new Date(look.savedAt).toISOString()}>{new Date(look.savedAt).toLocaleString()}</time>
          </div>
        </div>
        {confirmDelete === look.key ? <div className="space-y-2">
          <p className="text-sm">Delete this look and its saved media from this browser?</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} className="!px-3 text-sm" onClick={() => { onDelete(look.key); setConfirmDelete(null); }}>Delete look</Button>
            <Button variant="quiet" className="!px-3 text-sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          </div>
        </div> : <div className="flex flex-wrap gap-2">
          <Button disabled={pending} className="!px-4 text-sm" onClick={() => onOpen(look.key)}>Open look</Button>
          <Button disabled={pending} variant="link" className="text-sm" onClick={() => setConfirmDelete(look.key)}>Delete</Button>
        </div>}
      </li>)}
    </ul>
    <p className="mt-4 text-xs text-ink-soft">Clearing browser data removes saved looks. Download anything you want to keep as a backup.</p>
  </YincolCard>;
}

export function SavedMediaDownloads({ look }: { look: SavedLook }) {
  const [opened, setOpened] = useState<OpenedLook | null>(null);
  useEffect(() => { const next = openSavedLook(look); setOpened(next); return next.dispose; }, [look]);
  return <details className="mt-3">
    <summary className="cursor-pointer text-sm font-semibold">Download saved photos and video</summary>
    <ul className="mt-2 space-y-2">
      {opened?.downloads.map(media => <li key={media.id}>
        <a href={media.url} download={mediaFileName(media, look.savedAt)}
          className="inline-flex min-h-[44px] items-center text-sm underline underline-offset-4">
          {media.kind === 'video' ? 'Download video' : 'Download photo'} — {media.label}
        </a>
      </li>)}
    </ul>
  </details>;
}

export function CurrentMediaDownloads({ generation }: { generation: TryOnResponse }) {
  return <details className="mt-3">
    <summary className="cursor-pointer text-sm font-semibold">Download your current results</summary>
    <ul className="mt-2 space-y-2">{currentMediaLinks(generation).map((media, index) => <li key={media.url}>
      <a href={media.url} download={media.kind === 'video' ? 'yincol-motion.mp4' : `yincol-preview-${index + 1}`}
        className="inline-flex min-h-[44px] items-center text-sm underline underline-offset-4">
        {media.kind === 'video' ? 'Download video' : 'Download photo'} — {media.label}
      </a>
    </li>)}</ul>
  </details>;
}
