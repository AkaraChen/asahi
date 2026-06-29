import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DesktopSelectedRepository } from '../shared/githubPullRequests';
import {
  parseSelectedRepositories,
  SELECTED_REPOSITORIES_KEY,
} from '../shared/selectedRepositories';

export type ReviewFilter =
  | 'all'
  | 'pending-review'
  | 'approved'
  | 'changes-requested';
export type UpdatedFilter = 'all' | '24h' | '7d' | '30d';

interface DesktopHomeState {
  repositoryFilter: string;
  reviewFilter: ReviewFilter;
  selectedRepositories: DesktopSelectedRepository[];
  setRepositoryFilter(repositoryFilter: string): void;
  setReviewFilter(reviewFilter: ReviewFilter): void;
  setSelectedRepositories(repositories: DesktopSelectedRepository[]): void;
  setUpdatedFilter(updatedFilter: UpdatedFilter): void;
  updatedFilter: UpdatedFilter;
}

export const useDesktopHomeStore = create<DesktopHomeState>()(
  persist(
    (set) => ({
      repositoryFilter: 'all',
      reviewFilter: 'all',
      selectedRepositories: readLegacySelectedRepositories(),
      setRepositoryFilter(repositoryFilter) {
        set({ repositoryFilter });
      },
      setReviewFilter(reviewFilter) {
        set({ reviewFilter });
      },
      setSelectedRepositories(selectedRepositories) {
        set((state) => ({
          repositoryFilter:
            state.repositoryFilter !== 'all' &&
            selectedRepositories.every(
              (repository) =>
                repository.nameWithOwner !== state.repositoryFilter
            )
              ? 'all'
              : state.repositoryFilter,
          selectedRepositories,
        }));
      },
      setUpdatedFilter(updatedFilter) {
        set({ updatedFilter });
      },
      updatedFilter: 'all',
    }),
    {
      name: 'asahi:desktop-home',
      partialize: ({
        repositoryFilter,
        reviewFilter,
        selectedRepositories,
        updatedFilter,
      }) => ({
        repositoryFilter,
        reviewFilter,
        selectedRepositories,
        updatedFilter,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);

function readLegacySelectedRepositories(): DesktopSelectedRepository[] {
  return parseSelectedRepositories(
    localStorage.getItem(SELECTED_REPOSITORIES_KEY)
  );
}
