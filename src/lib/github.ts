import type { TrainingData } from '../types';
import { serialize } from './storage';

const GH_KEY = 'training-tracker:github';

export interface GithubSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export function defaultGithubSettings(): GithubSettings {
  return {
    token: '',
    owner: 'capdefra',
    repo: 'training-tracker',
    branch: 'main',
    path: 'public/data/training.json',
  };
}

export function loadGithubSettings(): GithubSettings {
  try {
    const raw = localStorage.getItem(GH_KEY);
    if (!raw) return defaultGithubSettings();
    const parsed = JSON.parse(raw) as Partial<GithubSettings>;
    return {
      token: typeof parsed.token === 'string' ? parsed.token : '',
      owner: parsed.owner?.trim() || 'capdefra',
      repo: parsed.repo?.trim() || 'training-tracker',
      branch: parsed.branch?.trim() || 'main',
      path: parsed.path?.trim() || 'public/data/training.json',
    };
  } catch {
    return defaultGithubSettings();
  }
}

export function saveGithubSettings(settings: GithubSettings): void {
  localStorage.setItem(GH_KEY, JSON.stringify(settings));
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function githubError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? response.statusText;
  } catch {
    return response.statusText || `GitHub responded with ${response.status}`;
  }
}

export async function commitTrainingFile(settings: GithubSettings, data: TrainingData): Promise<string> {
  const token = settings.token.trim();
  const owner = settings.owner.trim();
  const repo = settings.repo.trim();
  const branch = settings.branch.trim();
  const path = settings.path.trim().replace(/^\/+/, '');
  if (!token) throw new Error('Add a personal access token first.');
  if (!owner || !repo || !branch || !path) throw new Error('Owner, repository, branch, and file path are all required.');

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encoded}`;
  const existing = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
  let sha: string | undefined;
  if (existing.ok) {
    const body = (await existing.json()) as { sha?: string };
    sha = body.sha;
  } else if (existing.status !== 404) {
    throw new Error(await githubError(existing));
  }

  const sessionCount = data.sessions.length;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Update training log (${sessionCount} session${sessionCount === 1 ? '' : 's'})`,
      content: toBase64(serialize(data)),
      branch,
      sha,
    }),
  });
  if (!response.ok) throw new Error(await githubError(response));
  const body = (await response.json()) as { commit?: { html_url?: string } };
  return body.commit?.html_url ?? `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
}
