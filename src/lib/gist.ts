import type { TrainingData } from '../types';
import { emptyData, normalize, serialize } from './storage';

const TOKEN_KEY = 'training-tracker:gist-token';
const GIST_ID_KEY = 'training-tracker:gist-id';
export const GIST_FILENAME = 'training-tracker.json';

export interface GistConfig {
  gistId: string;
  token: string;
}

export function parseGistId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = /gist\.github\.com\/(?:[^/\s]+\/)?([a-fA-F0-9]+)/.exec(trimmed);
  return (fromUrl?.[1] ?? trimmed).trim();
}

export function loadGistConfig(): GistConfig | null {
  const gistId = localStorage.getItem(GIST_ID_KEY)?.trim() ?? '';
  const token = localStorage.getItem(TOKEN_KEY)?.trim() ?? '';
  if (!gistId || !token) return null;
  return { gistId, token };
}

export function saveGistConfig(gistId: string, token: string): void {
  localStorage.setItem(GIST_ID_KEY, gistId);
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearGistConfig(): void {
  localStorage.removeItem(GIST_ID_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

async function github(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...init.headers,
      },
    });
  } catch {
    throw new Error('Could not reach GitHub. The log is still saved in this browser.');
  }
  if (response.ok) return response;
  throw new Error(await githubMessage(response));
}

async function githubMessage(response: Response): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as { message?: string };
    detail = body.message?.toLowerCase() ?? '';
  } catch {
    detail = '';
  }
  if (response.status === 401) return 'GitHub rejected that token. Use a classic token with the gist scope.';
  if (response.status === 403 && detail.includes('gist')) return 'That token cannot use gists. Create a classic token with only the gist scope.';
  if (response.status === 403 && detail.includes('rate limit')) return 'GitHub rate limit reached. The log is still saved in this browser.';
  if (response.status === 404) return 'No gist with that id. Check the id, and that this token can open the gist.';
  if (response.status === 403) return 'GitHub refused the gist. The token needs the gist scope.';
  return `GitHub responded with ${response.status}. The log is still saved in this browser.`;
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}

export async function loadFromGist(token: string, gistId: string): Promise<TrainingData> {
  const response = await github(`/gists/${encodeURIComponent(gistId)}`, token);
  const gist = (await response.json()) as { files?: Record<string, GistFile | null> };
  const file = gist.files?.[GIST_FILENAME];
  if (!file) return emptyData();
  const raw = await readFile(file, token);
  return parseGistPayload(raw);
}

async function readFile(file: GistFile, token: string): Promise<string> {
  if (!file.truncated && typeof file.content === 'string') return file.content;
  if (!file.raw_url) return '';
  let response: Response;
  try {
    response = await fetch(file.raw_url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
  } catch {
    throw new Error('Could not reach GitHub. The log is still saved in this browser.');
  }
  if (!response.ok) throw new Error('Could not read training-tracker.json from the gist.');
  return response.text();
}

export function parseGistPayload(raw: string): TrainingData {
  const text = raw.trim();
  if (!text || text === '{}' || text === '[]') return emptyData();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('training-tracker.json in the gist is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('training-tracker.json in the gist needs to be a JSON object.');
  }
  const record = parsed as Record<string, unknown>;
  if (!('goals' in record) && !('plans' in record) && !('sessions' in record) && !('presets' in record)) {
    return emptyData();
  }
  return normalize({
    ...record,
    goals: record.goals ?? [],
    plans: record.plans ?? [],
    presets: record.presets ?? [],
    sessions: record.sessions ?? [],
  });
}

export async function saveToGist(token: string, gistId: string, data: TrainingData): Promise<void> {
  await github(`/gists/${encodeURIComponent(gistId)}`, token, {
    method: 'PATCH',
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: { content: serialize(data) },
      },
    }),
  });
}
