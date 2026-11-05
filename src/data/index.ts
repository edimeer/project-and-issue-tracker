import { LocalStorageRepository } from './localStorageRepository';
import type { Repository } from './repository';

/**
 * The single place that decides which Repository the app uses.
 * To move to a Rails API, return an ApiRepository here instead.
 */
export function createRepository(): Repository {
  return new LocalStorageRepository({
    storage: window.localStorage,
    // BASE_URL is the deploy sub-path, so two apps on one github.io origin never share data.
    key: `plumbline:v1:${import.meta.env.BASE_URL}`,
  });
}

export type { Repository } from './repository';
