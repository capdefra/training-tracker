import { useCallback, useEffect, useState } from 'react';
import { Icon, type IconName } from './components/Icon';
import { StrengthSession } from './components/StrengthSession';
import { cx } from './lib/cx';
import { applyTemplateMeta, blankDraft, draftFromPreset, draftFromSession } from './lib/draft';
import { todayISO } from './lib/dates';
import { uid } from './lib/ids';
import { findPlanSession } from './lib/plans';
import { requestScreenWakeLock } from './lib/screen-wake';
import { clearPendingLaunch, clearStrengthProgress, freshProgress, loadStrengthProgress, readPendingLaunch, writePendingLaunch } from './lib/session-progress';
import { useHashRoute, type RouteName } from './hooks/useHashRoute';
import { useScreenWakeLock } from './hooks/useScreenWakeLock';
import { useTrainingData } from './hooks/useTrainingData';
import { removeSession } from './lib/storage';
import type { LogPreset, Session, TrainingData } from './types';
import type { DraftRequest } from './views/draft-request';
import { ActivityView } from './views/ActivityView';
import { DataView } from './views/DataView';
import { LogView } from './views/LogView';
import { PlansView } from './views/PlansView';
import { ProgressView } from './views/ProgressView';
import { TodayView } from './views/TodayView';

function goToHash(hash: string) {
  window.location.hash = hash;
}

const NAV: { href: string; name: RouteName; label: string; icon: IconName }[] = [
  { href: '#/today', name: 'today', label: 'Today', icon: 'today' },
  { href: '#/log', name: 'log', label: 'Log', icon: 'log' },
  { href: '#/plans', name: 'plans', label: 'Plans', icon: 'plans' },
  { href: '#/progress', name: 'progress', label: 'Progress', icon: 'progress' },
  { href: '#/activity', name: 'activity', label: 'Activity', icon: 'activity' },
  { href: '#/data', name: 'data', label: 'Data', icon: 'data' },
];

export default function App() {
  return <Tracker />;
}

function Tracker() {
  useScreenWakeLock();
  const store = useTrainingData();
  const route = useHashRoute();
  const [request, setRequest] = useState<DraftRequest>({ token: 0, mode: 'new' });

  useEffect(() => {
    if (window.location.hash.startsWith('#/prototype')) goToHash(loadStrengthProgress() ? '#/session' : '#/today');
  }, [route.name]);

  useEffect(() => {
    const titles: Record<RouteName, string> = {
      today: 'Today',
      log: 'Log',
      plans: 'Plans',
      progress: 'Progress',
      activity: 'Activity',
      data: 'Data',
      session: 'Strength',
    };
    document.title = `${titles[route.name]} · Training Tracker`;
    window.scrollTo({ top: 0 });
  }, [route.name, route.id, route.date]);

  const discardSession = useCallback(() => {
    clearStrengthProgress();
    clearPendingLaunch();
    goToHash('#/today');
  }, []);

  function openStrength(preset?: LogPreset) {
    const current = store.data;
    if (!current) return;
    requestScreenWakeLock();
    const draft = preset ? draftFromPreset(preset, current.sessions) : blankDraft(todayISO());
    writePendingLaunch(freshProgress(draft, uid('log'), new Date().toISOString()));
    goToHash('#/session');
  }

  function resumeStrength() {
    requestScreenWakeLock();
    clearPendingLaunch();
    goToHash('#/session');
  }

  function openLog(preset?: LogPreset) {
    requestScreenWakeLock();
    if (!preset || preset.kind === 'strength') {
      openStrength(preset);
      return;
    }
    setRequest({ token: Date.now(), mode: 'preset', preset });
    goToHash('#/log');
  }

  function openLogNav() {
    if (loadStrengthProgress()) resumeStrength();
    else openStrength();
  }

  if (store.status === 'error' && !store.data) {
    return (
      <div className="boot">
        <p className="kicker">Training Tracker</p>
        <h1>The log file didn’t load</h1>
        <p>{store.error}</p>
        <button type="button" className="btn primary" onClick={store.startBlank}>
          Start with an empty log
        </button>
      </div>
    );
  }

  if (!store.data || store.status === 'loading') {
    return (
      <div className="boot">
        <p className="kicker">Training Tracker</p>
        <h1>Loading the log…</h1>
      </div>
    );
  }

  const data = store.data;
  const strengthEdit = route.name === 'log' && route.id ? data.sessions.find((session) => session.id === route.id) : undefined;
  if (route.name === 'session' || strengthEdit?.kind === 'strength') {
    return (
      <StrengthSession
        key={strengthEdit?.kind === 'strength' ? strengthEdit.id : 'live'}
        incoming={strengthEdit?.kind === 'strength' ? progressForSaved(data, strengthEdit) : readPendingLaunch()}
        existing={strengthEdit?.kind === 'strength' ? strengthEdit : undefined}
        onSave={(session) => {
          clearStrengthProgress();
          clearPendingLaunch();
          store.update((current) => ({
            ...current,
            sessions: current.sessions.some((item) => item.id === session.id)
              ? current.sessions.map((item) => (item.id === session.id ? session : item))
              : [...current.sessions, session],
          }));
          goToHash('#/today');
        }}
        onDelete={(id) => {
          clearStrengthProgress();
          clearPendingLaunch();
          store.update((current) => removeSession(current, id));
          goToHash('#/today');
        }}
        onExit={discardSession}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/today">
          <BrandMark />
          <span>
            <strong>Training Tracker</strong>
            <small>Strength, runs, and the season</small>
          </span>
        </a>
      </header>
      <div className="shell">
        <nav className="sidenav" aria-label="Primary">
          <a className="brand" href="#/today">
            <BrandMark />
            <span>
              <strong>Training Tracker</strong>
              <small>Strength, runs, and the season</small>
            </span>
          </a>
          {NAV.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={cx('nav-link', route.name === item.name && 'on')}
              aria-current={route.name === item.name ? 'page' : undefined}
              onClick={(event) => {
                if (item.name !== 'log') return;
                event.preventDefault();
                openLogNav();
              }}
            >
              <Icon name={item.icon} />
              {item.label}
            </a>
          ))}
          <p className="nav-status">{syncLabel(store.syncStatus, store.gistId, store.dirty, store.repo === null)}</p>
        </nav>
        <main className="content">
          {route.name === 'today' ? <TodayView key={route.date ?? 'today'} data={data} onLog={openLog} date={route.date} /> : null}
          {route.name === 'log' ? (
            <LogView
              key={route.id ? `edit-${route.id}` : `new-${request.token}`}
              data={data}
              sessionId={route.id}
              request={request}
              onStrength={openStrength}
              onSave={(session) => {
                store.update((current) => ({
                  ...current,
                  sessions: current.sessions.some((item) => item.id === session.id)
                    ? current.sessions.map((item) => (item.id === session.id ? session : item))
                    : [...current.sessions, session],
                }));
                goToHash('#/today');
              }}
              onDelete={(id) => {
                store.update((current) => removeSession(current, id));
                goToHash('#/today');
              }}
            />
          ) : null}
          {route.name === 'plans' ? <PlansView data={data} goalId={route.id} update={store.update} onLog={openLog} /> : null}
          {route.name === 'progress' ? <ProgressView data={data} onLog={openLog} /> : null}
          {route.name === 'activity' ? <ActivityView data={data} /> : null}
          {route.name === 'data' ? (
            <DataView
              data={data}
              dirty={store.dirty}
              persisted={store.persisted}
              syncStatus={store.syncStatus}
              syncError={store.syncError}
              gistId={store.gistId}
              gistConnected={store.gistConnected}
              onConnectGist={store.connectGist}
              onDisconnectGist={store.disconnectGist}
              onForceSync={store.forceSync}
              onImport={store.replaceAll}
              onReload={store.resetToRepo}
              onSynced={store.markRepoSynced}
            />
          ) : null}
        </main>
      </div>
      <nav className="tabbar" aria-label="Primary">
        {NAV.map((item) => (
          <a
            key={item.name}
            href={item.href}
            className={cx('tab-link', route.name === item.name && 'on')}
            aria-current={route.name === item.name ? 'page' : undefined}
            onClick={(event) => {
              if (item.name !== 'log') return;
              event.preventDefault();
              openLogNav();
            }}
          >
            <Icon name={item.icon} />
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

function progressForSaved(data: TrainingData, session: Session) {
  const template = session.planSessionId ? findPlanSession(data, session.planSessionId, session.date)?.session.exercises ?? [] : [];
  return freshProgress(applyTemplateMeta(draftFromSession(session), template), session.id, session.createdAt);
}

function syncLabel(status: 'idle' | 'syncing' | 'synced' | 'error', gistId: string, dirty: boolean, repoMissing: boolean): string {
  if (gistId) {
    if (status === 'syncing') return 'Syncing the gist…';
    if (status === 'synced') return 'Synced to your gist';
    if (status === 'error') return 'Gist sync needs attention';
    return 'Gist sync is on';
  }
  if (repoMissing) return 'Saved in this browser';
  return dirty ? 'Edits are in this browser only' : 'Matches the site file';
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="28" height="28">
        <path d="M6 24 L16 8 L26 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="16" cy="16" r="1.6" fill="#e8a317" />
      </svg>
    </span>
  );
}
