import { useEffect, useState } from 'react';
import { isISODate } from '../lib/dates';

export type RouteName = 'today' | 'log' | 'plans' | 'progress' | 'activity' | 'data';

export interface Route {
  name: RouteName;
  id?: string;
  /** Selected day when opening Today from the activity tab (`#/today/YYYY-MM-DD`). */
  date?: string;
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean);
  const head = parts[0] ?? 'today';
  if (head === 'log') return { name: 'log', id: parts[1] };
  if (head === 'plans') return { name: 'plans', id: parts[1] };
  if (head === 'progress') return { name: 'progress' };
  if (head === 'activity') return { name: 'activity' };
  if (head === 'data') return { name: 'data' };
  const date = parts[1];
  return { name: 'today', date: date && isISODate(date) ? date : undefined };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
