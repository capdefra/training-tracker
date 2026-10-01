import { useCallback, useEffect, useState } from 'react';
import { clearLocal, emptyData, loadLocal, loadRepo, normalize, saveLocal, serialize } from '../lib/storage';
import type { TrainingData } from '../types';

export function useTrainingData() {
  const [data, setData] = useState<TrainingData | null>(null);
  const [repo, setRepo] = useState<TrainingData | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const remote = await loadRepo();
        if (cancelled) return;
        setRepo(remote);
        const local = loadLocal();
        if (local) {
          setData(local);
          setPersisted(true);
        } else {
          setData(remote);
          setPersisted(false);
        }
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        const local = loadLocal();
        if (local) {
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
    };
  }, []);

  const update = useCallback((recipe: (current: TrainingData) => TrainingData) => {
    setData((current) => {
      if (!current) return current;
      const next = normalize(recipe(current));
      saveLocal(next);
      return next;
    });
    setPersisted(true);
  }, []);

  const replaceAll = useCallback((next: TrainingData) => {
    const clean = normalize(next);
    saveLocal(clean);
    setPersisted(true);
    setData(clean);
  }, []);

  const resetToRepo = useCallback(async () => {
    const fresh = await loadRepo();
    clearLocal();
    setRepo(fresh);
    setData(fresh);
    setPersisted(false);
  }, []);

  const markRepoSynced = useCallback(() => {
    if (data) setRepo(normalize(data));
  }, [data]);

  const startBlank = useCallback(() => {
    const blank = emptyData();
    saveLocal(blank);
    setPersisted(true);
    setData(blank);
    setStatus('ready');
    setError(null);
  }, []);

  const dirty = data !== null && repo !== null && serialize(data) !== serialize(repo);

  return {
    data,
    repo,
    persisted,
    dirty,
    status,
    error,
    update,
    replaceAll,
    resetToRepo,
    markRepoSynced,
    startBlank,
  };
}

export type TrainingStore = ReturnType<typeof useTrainingData>;
