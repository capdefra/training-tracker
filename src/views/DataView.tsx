import { useState } from 'react';
import { commitTrainingFile, loadGithubSettings, saveGithubSettings, type GithubSettings } from '../lib/github';
import { GIST_FILENAME } from '../lib/gist';
import { downloadData, normalize, serialize } from '../lib/storage';
import type { SyncStatus } from '../hooks/useTrainingData';
import type { TrainingData } from '../types';

export function DataView({
  data,
  dirty,
  persisted,
  syncStatus,
  syncError,
  gistId,
  gistConnected,
  onConnectGist,
  onDisconnectGist,
  onForceSync,
  onImport,
  onReload,
  onSynced,
}: {
  data: TrainingData;
  dirty: boolean;
  persisted: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  gistId: string;
  gistConnected: boolean;
  onConnectGist: (gistId: string, token: string) => Promise<void>;
  onDisconnectGist: () => void;
  onForceSync: () => Promise<void>;
  onImport: (data: TrainingData) => void;
  onReload: () => Promise<void>;
  onSynced: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [settings, setSettings] = useState<GithubSettings>(() => loadGithubSettings());
  const [commitUrl, setCommitUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gistInput, setGistInput] = useState(gistId);
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);

  function report(text: string) {
    setError(null);
    setMessage(text);
  }

  function fail(text: string) {
    setMessage(null);
    setError(text);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(serialize(data));
      report('Copied the log to the clipboard.');
    } catch {
      setShowPaste(true);
      setPaste(serialize(data));
      fail('Clipboard is blocked. The JSON is in the box below.');
    }
  }

  async function importText(text: string) {
    try {
      onImport(normalize(JSON.parse(text)));
      report('Imported. This browser is now using that file.');
      setShowPaste(false);
    } catch (err) {
      fail(err instanceof Error ? err.message : 'That JSON could not be read.');
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    await importText(await file.text());
  }

  async function reload() {
    try {
      await onReload();
      setConfirmReload(false);
      report('Reloaded the file shipped with this site. Browser edits were discarded.');
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Could not reload the file.');
    }
  }

  async function commit() {
    setBusy(true);
    setCommitUrl(null);
    try {
      saveGithubSettings(settings);
      const url = await commitTrainingFile(settings, data);
      onSynced();
      setCommitUrl(url);
      report('Committed to GitHub. Pages will rebuild from that push.');
    } catch (err) {
      fail(err instanceof Error ? err.message : 'GitHub rejected the commit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack page">
      <header className="page-head">
        <p className="kicker">Storage</p>
        <h1>Data</h1>
        <p className="lead">
          {data.sessions.length} sessions · {data.presets.length} presets · {data.goals.length} {data.goals.length === 1 ? 'goal' : 'goals'} ·{' '}
          {data.plans.length} {data.plans.length === 1 ? 'plan' : 'plans'}
        </p>
      </header>

      <GistSync
        connected={gistConnected}
        gistId={gistId}
        gistInput={gistInput}
        tokenInput={tokenInput}
        status={syncStatus}
        error={syncError}
        connecting={connecting}
        onGistInput={setGistInput}
        onTokenInput={setTokenInput}
        onConnect={() => {
          setConnecting(true);
          void onConnectGist(gistInput, tokenInput)
            .then(() => {
              setTokenInput('');
              report('Connected. This browser and the gist now share one log.');
            })
            .catch(() => undefined)
            .finally(() => setConnecting(false));
        }}
        onDisconnect={() => {
          onDisconnectGist();
          setTokenInput('');
          setGistInput('');
          report('Disconnected. The log in this browser stays here.');
        }}
        onSync={() => {
          void onForceSync()
            .then(() => report('Synced with the gist.'))
            .catch(() => undefined);
        }}
      />

      <section className="card stack">
        <h2>Where the log lives</h2>
        <p>
          This browser keeps a cache so logging works offline. A private gist is the copy your phone and laptop share. The file shipped with the site, <code>public/data/training.json</code>, is only the starter program.
        </p>
        <p className={dirty ? 'callout' : 'notice'}>
          {dirty
            ? 'This browser has edits that are not in the file the site was built with.'
            : persisted
              ? 'This browser matches the file the site was built with.'
              : 'Reading the file shipped with this site. The first edit is stored in this browser.'}
        </p>
      </section>

      <section className="card stack">
        <h2>Save it back to the repo</h2>
        <ol className="steps">
          <li>Download <code>training.json</code>.</li>
          <li>
            Replace <code>public/data/training.json</code>.
          </li>
          <li>Commit and push to <code>main</code>. GitHub Actions republishes the site.</li>
        </ol>
        <pre className="codeblock">{`cp ~/Downloads/training.json public/data/training.json
git add public/data/training.json
git commit -m "Update training log"
git push`}</pre>
        <div className="form-actions">
          <button type="button" className="btn primary" onClick={() => downloadData(data)}>
            Download training.json
          </button>
          <button type="button" className="btn ghost" onClick={() => void copy()}>
            Copy JSON
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Import or reload</h2>
        <label className="btn ghost file-btn">
          Import a JSON file
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        <button type="button" className="btn ghost" onClick={() => setShowPaste((open) => !open)}>
          {showPaste ? 'Hide paste box' : 'Paste JSON'}
        </button>
        {showPaste ? (
          <div className="stack">
            <textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={8} aria-label="Training JSON" />
            <button type="button" className="btn primary small" onClick={() => void importText(paste)}>
              Import pasted JSON
            </button>
          </div>
        ) : null}
        {!confirmReload ? (
          <button type="button" className="btn danger ghost" onClick={() => setConfirmReload(true)}>
            Reload the site file
          </button>
        ) : (
          <div className="confirm">
            <p>
              {gistConnected
                ? 'Load the program shipped with the site, then merge it with the gist. Sessions already in the gist stay.'
                : 'Discard browser edits and load the file this site was built with?'}
            </p>
            <button type="button" className="btn danger small" onClick={() => void reload()}>
              Discard and reload
            </button>
            <button type="button" className="btn ghost small" onClick={() => setConfirmReload(false)}>
              Keep my log
            </button>
          </div>
        )}
      </section>

      <details className="card stack">
        <summary>Publish the starter file to the repository</summary>
        <p>
          Optional, and separate from gist sync. A fine-grained token with Contents read and write on this repository can update <code>public/data/training.json</code>.
          That token stays in this browser and is never written into the log. Day-to-day logging uses the gist above.
        </p>
        <label className="field">
          <span>Token</span>
          <input
            type="password"
            value={settings.token}
            autoComplete="off"
            onChange={(event) => setSettings({ ...settings, token: event.target.value })}
          />
        </label>
        <div className="form-grid two">
          <label className="field">
            <span>Owner</span>
            <input value={settings.owner} onChange={(event) => setSettings({ ...settings, owner: event.target.value })} />
          </label>
          <label className="field">
            <span>Repository</span>
            <input value={settings.repo} onChange={(event) => setSettings({ ...settings, repo: event.target.value })} />
          </label>
          <label className="field">
            <span>Branch</span>
            <input value={settings.branch} onChange={(event) => setSettings({ ...settings, branch: event.target.value })} />
          </label>
          <label className="field">
            <span>Path</span>
            <input value={settings.path} onChange={(event) => setSettings({ ...settings, path: event.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void commit()}>
            {busy ? 'Committing…' : 'Commit to GitHub'}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              saveGithubSettings(settings);
              report('Saved the GitHub settings in this browser.');
            }}
          >
            Save settings
          </button>
        </div>
        {commitUrl ? (
          <p>
            <a className="text-link" href={commitUrl} target="_blank" rel="noreferrer">
              Open the commit
            </a>
          </p>
        ) : null}
      </details>

      {message ? <p className="notice">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function GistSync({
  connected,
  gistId,
  gistInput,
  tokenInput,
  status,
  error,
  connecting,
  onGistInput,
  onTokenInput,
  onConnect,
  onDisconnect,
  onSync,
}: {
  connected: boolean;
  gistId: string;
  gistInput: string;
  tokenInput: string;
  status: SyncStatus;
  error: string | null;
  connecting: boolean;
  onGistInput: (value: string) => void;
  onTokenInput: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  const label = status === 'syncing' ? 'Syncing' : status === 'synced' ? 'Synced' : status === 'error' ? 'Needs attention' : 'Not syncing';
  return (
    <section className="card stack">
      <div className="split">
        <h2>Sync across devices</h2>
        <span className={`sync-pill ${status}`}>
          <i className="sync-dot" />
          {label}
        </span>
      </div>
      <p>
        The log in this browser is a cache. A private GitHub gist is the copy your phone and laptop share. The gist id and token stay in this browser and are never written into the training file.
      </p>
      {connected ? (
        <div className="stack">
          <p>
            Connected to gist <code>{gistId}</code>, file <code>{GIST_FILENAME}</code>.
          </p>
          {error ? <p className="error">{error}</p> : null}
          <div className="form-actions">
            <button type="button" className="btn primary" disabled={status === 'syncing'} onClick={onSync}>
              Sync now
            </button>
            <button type="button" className="btn danger ghost" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <ol className="steps">
            <li>
              Create a <a className="text-link" href="https://github.com/settings/tokens/new?scopes=gist&description=Training%20tracker" target="_blank" rel="noreferrer">classic personal access token</a> with only the <code>gist</code> scope.
            </li>
            <li>
              Create a <a className="text-link" href="https://gist.github.com/" target="_blank" rel="noreferrer">secret gist</a>. Name the file <code>{GIST_FILENAME}</code>. The contents can be <code>{'{}'}</code>.
            </li>
            <li>Copy the gist id from the URL (the long id after your username) and paste it here, on each device, with the token.</li>
          </ol>
          <label className="field">
            <span>Gist id or URL</span>
            <input
              value={gistInput}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="gist.github.com/you/…"
              onChange={(event) => onGistInput(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Token</span>
            <input
              type="password"
              value={tokenInput}
              autoComplete="off"
              placeholder="ghp_…"
              onChange={(event) => onTokenInput(event.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="button" className="btn primary" disabled={connecting || !gistInput.trim() || !tokenInput.trim()} onClick={onConnect}>
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      )}
    </section>
  );
}
