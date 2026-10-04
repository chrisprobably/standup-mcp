import type { CardWork } from './standupClient.js';

export type CardWorkUpdate = Partial<CardWork>;

export function mergeCardWork(existing: CardWork | undefined, update: CardWorkUpdate): CardWork | null {
  const branch = update.branch ?? existing?.branch;
  if (!branch) return null;

  const commits = [...(existing?.commits ?? [])];
  for (const commit of update.commits ?? []) {
    if (!commits.includes(commit)) commits.push(commit);
  }

  const merged: CardWork = {
    branch,
    commits,
    pushed: update.pushed ?? existing?.pushed ?? false,
  };
  const repositoryPath = update.repositoryPath ?? existing?.repositoryPath;
  const pullRequestUrl = update.pullRequestUrl ?? existing?.pullRequestUrl;
  if (repositoryPath) merged.repositoryPath = repositoryPath;
  if (pullRequestUrl) merged.pullRequestUrl = pullRequestUrl;
  return merged;
}
