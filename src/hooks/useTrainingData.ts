import { useCallback, useEffect, useRef, useState } from 'react';
import { clearGistConfig, loadFromGist, loadGistConfig, parseGistId, saveGistConfig, saveToGist } from '../lib/gist';
import { mergeTraining } from '../lib/merge';
import { clearLocal, emptyData, loadLocal, loadRepo, normalize, saveLocal, serialize } from '../lib/storage';
import type { TrainingData } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export function useTrainingData() {
  const [data, setData] = useState<TrainingData | null>(null);
  const [repo, setRepo] = useState<TrainingData | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (loadGistConfig() ? 'idle' : 'idle'));
  const [syncError, setSyncError] = useState<string | null>(null);
  const [gistId, setGistId] = useState(() => loadGistConfig()?.gistId ?? '');
  const latest = useRef<TrainingData | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remember = useCallback((next: TrainingData) => {
    latest.current = next;
    return next;
  }, []);

  const queueGistSave = useCallback((next: TrainingData) => {
    latest.current = next;
    const config = loadGistConfig();
    if (!config) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const snapshot = latest.current;
      const current = loadGistConfig();
      if (!snapshot || !current) return;
      setSyncStatus('syncing');
      setSyncError(null);
      void saveToGist(current.token, current.gistId, snapshot)
        .then(() => setSyncStatus('synced'))
        .catch((err: unknown) => {
          setSyncStatus('error');
          setSyncError(err instanceof Error ? err.message : 'Could not save to the gist.');
        });
    }, 1500);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const remote = await loadRepo();
        if (cancelled) return;
        setRepo(remote);
        const local = loadLocal();
        const initial = remember(local ?? remote);
        setData(initial);
        setPersisted(local !== null);
        setStatus('ready');
        const config = loadGistConfig();
        if (!config) return;
        setSyncStatus('syncing');
        try {
          const gistData = await loadFromGist(config.token, config.gistId);
          if (cancelled) return;
          const merged = remember(mergeTraining(initial, gistData));
          saveLocal(merged);
          setData(merged);
          setPersisted(true);
          await saveToGist(config.token, config.gistId, merged);
          if (!cancelled) {
            setSyncStatus('synced');
            setSyncError(null);
          }
        } catch (err) {
          if (cancelled) return;
          setSyncStatus('error');
          setSyncError(err instanceof Error ? err.message : 'Could not sync the gist.');
        }
      } catch (err) {
        if (cancelled) return;
        const local = loadLocal();
        if (local) {
          remember(local);
          setData(local);
          setPersisted(true);
          setStatus('ready');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load training data.');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [remember]);

  const update = useCallback(
    (recipe: (current: TrainingData) => TrainingData) => {
      setData((current) => {
        if (!current) return current;
        const next = remember(normalize(recipe(current)));
        saveLocal(next);
        queueGistSave(next);
        return next;
      });
      setPersisted(true);
    },
    [queueGistSave, remember],
  );

  const replaceAll = useCallback(
    (next: TrainingData) => {
      const clean = remember(normalize(next));
      saveLocal(clean);
      setPersisted(true);
      setData(clean);
      queueGistSave(clean);
    },
    [queueGistSave, remember],
  );

  const resetToRepo = useCallback(async () => {
    const fresh = await loadRepo();
    setRepo(fresh);
    const config = loadGistConfig();
    if (config) {
      setSyncStatus('syncing');
      const remote = await loadFromGist(config.token, config.gistId);
      const merged = remember(mergeTraining(fresh, remote));
      saveLocal(merged);
      setData(merged);
      setPersisted(true);
      await saveToGist(config.token, config.gistId, merged);
      setSyncStatus('synced');
      setSyncError(null);
      return;
    }
    clearLocal();
    remember(fresh);
    setData(fresh);
    setPersisted(false);
  }, [remember]);

  const markRepoSynced = useCallback(() => {
    if (latest.current) setRepo(normalize(latest.current));
  }, []);

  const startBlank = useCallback(() => {
    const blank = remember(emptyData());
    saveLocal(blank);
    setPersisted(true);
    setData(blank);
    setStatus('ready');
    setError(null);
  }, [remember]);

  const connectGist = useCallback(
    async (gistInput: string, tokenInput: string) => {
      const token = tokenInput.trim();
      const id = parseGistId(gistInput);
      if (!token || !id) throw new Error('Enter the gist id and a token with the gist scope.');
      if (!/^[a-fA-F0-9]{8,}$/.test(id)) throw new Error('That gist id does not look right. Paste the id or the gist URL.');
      setSyncStatus('syncing');
      setSyncError(null);
      try {
        const remote = await loadFromGist(token, id);
        saveGistConfig(id, token);
        setGistId(id);
        const base = latest.current ?? emptyData();
        const merged = remember(mergeTraining(base, remote));
        saveLocal(merged);
        setData(merged);
        setPersisted(true);
        await saveToGist(token, id, merged);
        setSyncStatus('synced');
      } catch (err) {
        setSyncStatus('error');
        const message = err instanceof Error ? err.message : 'Could not open that gist.';
        setSyncError(message);
        throw new Error(message);
      }
    },
    [remember],
  );

  const disconnectGist = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    clearGistConfig();
    setGistId('');
    setSyncStatus('idle');
    setSyncError(null);
  }, []);

  const forceSync = useCallback(async () => {
    const config = loadGistConfig();
    const current = latest.current;
    if (!config || !current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const remote = await loadFromGist(config.token, config.gistId);
      const merged = remember(mergeTraining(current, remote));
      saveLocal(merged);
      setData(merged);
      setPersisted(true);
      await saveToGist(config.token, config.gistId, merged);
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : 'Could not sync the gist.');
      throw err;
    }
  }, [remember]);

  const dirty = data !== null && repo !== null && serialize(data) !== serialize(repo);

  return {
    data,
    repo,
    persisted,
    dirty,
    status,
    error,
    syncStatus,
    syncError,
    gistId,
    gistConnected: gistId.length > 0 && loadGistConfig() !== null,
    update,
    replaceAll,
    resetToRepo,
    markRepoSynced,
    startBlank,
    connectGist,
    disconnectGist,
    forceSync,
  };
}

export type TrainingStore = ReturnType<typeof useTrainingData>;
