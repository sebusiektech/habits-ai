import { useEffect, useRef, useState } from 'react';
import { makeBackup, parseBackupText, type BackupFile } from '../db/backup';
import * as repo from '../db/repo';
import { tr } from '../i18n';
import { useStore } from '../store';
import { Confirm, Header, Segmented, Sheet } from '../components/ui';

export default function Settings() {
  const { data, run, notify, today } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ b: BackupFile; counts: Record<string, number>; ignored: number } | null>(null);
  const [wipe, setWipe] = useState(false);
  const [clearOld, setClearOld] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState('');
  const [legacy, setLegacy] = useState<Record<string, number>>({});

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    navigator.storage?.estimate?.().then(e => e.usage !== undefined && setUsage(tr('{n} KB used', { n: (e.usage / 1024).toFixed(0) }))).catch(() => {});
    repo.loadLegacyCounts().then(setLegacy).catch(() => {});
  }, []);
  const legacyTotal = Object.values(legacy).reduce((a, b) => a + b, 0);

  const exportJson = async () => {
    const text = JSON.stringify(makeBackup(data), null, 2);
    const name = `habits-backup-${today}.json`;
    const file = new File([text], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); notify('Backup ready'); return; }
    } catch (e) { if ((e as Error).name === 'AbortError') return; }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    notify('Backup downloaded');
  };
  const pick = async (f?: File) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return notify('That file is too large to be a habits. backup.', 'error');
    const res = parseBackupText(await f.text());
    if (!res.ok) return notify(res.error, 'error');
    setPending({ b: res.backup, counts: res.counts, ignored: res.ignored });
    if (fileRef.current) fileRef.current.value = '';
  };
  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const b = pending.b; setPending(null);
    await run(() => repo.importBackup(b, mode), mode === 'merge' ? 'Backup merged' : 'Backup restored');
  };
  const persist = async () => { const ok = await navigator.storage?.persist?.(); setPersisted(!!ok); notify(ok ? 'Storage protected' : 'The browser declined. Make regular backups.', ok ? 'info' : 'error'); };

  return (<>
    <Header title={tr('Settings')} />

    <h2 className="h2">{tr('Language')}</h2>
    <div className="card">
      {/* Language names stay in their own language so they remain recognisable after a mistaken switch. */}
      <Segmented value={data.prefs.lang} onChange={v => run(() => repo.savePrefs({ ...data.prefs, lang: v }))} options={[{ value: 'en', label: 'English' }, { value: 'pl', label: 'Polski' }]} />
    </div>

    <h2 className="h2">{tr('Appearance')}</h2>
    <div className="card">
      <Segmented value={data.prefs.theme} onChange={v => run(() => repo.savePrefs({ ...data.prefs, theme: v }))}
        options={[{ value: 'dark', label: tr('Dark') }, { value: 'light', label: tr('Light') }, { value: 'system', label: tr('System') }]} />
      <p className="small dim" style={{ marginTop: 10 }}>{tr("System follows your device's light or dark setting.")}</p>
      <span className="label">{tr('Week starts on')}</span>
      <Segmented value={String(data.prefs.weekStart)} onChange={v => run(() => repo.savePrefs({ ...data.prefs, weekStart: v === '0' ? 0 : 1 }))} options={[{ value: '1', label: tr('Monday') }, { value: '0', label: tr('Sunday') }]} />
    </div>

    <h2 className="h2">{tr('Your data')}</h2>
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <p className="small muted">{tr('Everything lives only on this device. Clearing Safari website data or storage eviction can erase it, so export a backup regularly and keep the file in iCloud Drive or Files.')}</p>
      <button className="btn btn-primary" onClick={exportJson}>{tr('Export backup (JSON)')}</button>
      <button className="btn" onClick={() => fileRef.current?.click()}>{tr('Import backup…')}</button>
      <input ref={fileRef} className="hidden-input" type="file" accept="application/json,.json" onChange={e => pick(e.target.files?.[0])} tabIndex={-1} aria-hidden="true" />
      <p className="small dim">{tr('Persistent storage')}: {persisted === null ? tr('unknown') : persisted ? tr('granted') : tr('not granted')}{usage ? ` · ${usage}` : ''}</p>
      {!persisted && <button className="btn" onClick={persist}>{tr('Ask browser to protect my data')}</button>}
    </div>

    {legacyTotal > 0 && <>
      <h2 className="h2">{tr('Old data')}</h2>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <p className="small muted">{tr('{n} records from removed features (tasks, focus sessions, routines, goals, journal) are still stored on this device but are no longer used or exported.', { n: legacyTotal })}</p>
        <button className="btn btn-danger" onClick={() => setClearOld(true)}>{tr('Delete old data')}</button>
      </div>
    </>}

    <h2 className="h2">{tr('iPhone notes')}</h2>
    <div className="card small muted" style={{ display: 'grid', gap: 8 }}>
      <p>{tr("Install from Safari: Share → Add to Home Screen. Only the Home Screen icon opens the standalone app without Safari's toolbars.")}</p>
      <p>{tr('The Home Screen app and Safari keep separate storage on iOS — export from one and import into the other if you move.')}</p>
    </div>

    <h2 className="h2">{tr('Danger zone')}</h2>
    <button className="btn btn-danger btn-block" onClick={() => setWipe(true)}>{tr('Delete all data')}</button>

    <Sheet open={!!pending} onClose={() => setPending(null)} title={tr('Import backup')}>
      {pending && <>
        <p className="muted small" style={{ marginBottom: 12 }}>{tr('{h} habits · {c} completions', { h: pending.counts.habits, c: pending.counts.completions })}</p>
        {pending.ignored > 0 && <p className="small dim" style={{ marginBottom: 12 }}>{tr('{n} records from removed features in this file will be ignored.', { n: pending.ignored })}</p>}
        <p className="muted" style={{ marginBottom: 16 }}><b>{tr('Merge')}</b> {tr("adds records that don't exist yet and keeps what you have.")} <b>{tr('Replace')}</b> {tr('erases current data first — export a backup before using it.')}</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn-primary btn-block" onClick={() => doImport('merge')}>{tr('Merge')}</button>
          <button className="btn btn-danger btn-block" onClick={() => doImport('replace')}>{tr('Replace all current data')}</button>
          <button className="btn btn-block" onClick={() => setPending(null)}>{tr('Cancel')}</button>
        </div></>}
    </Sheet>
    <Confirm open={clearOld} danger title={tr('Delete old data?')} message={tr('This permanently deletes the leftover tasks, sessions, routines, goals and journal entries. Your habits and history are not affected.')} confirmLabel={tr('Delete old data')}
      onCancel={() => setClearOld(false)} onConfirm={async () => { setClearOld(false); if (await run(() => repo.removeLegacyData(), 'Old data deleted')) setLegacy({}); }} />
    <Confirm open={wipe} danger title={tr('Delete everything?')} message={tr('All habits and their history on this device will be permanently erased. Export a backup first if unsure.')} confirmLabel={tr('Delete all data')}
      onCancel={() => setWipe(false)} onConfirm={async () => { setWipe(false); await run(() => repo.wipeEverything(), 'All data deleted'); setLegacy({}); }} />
  </>);
}
