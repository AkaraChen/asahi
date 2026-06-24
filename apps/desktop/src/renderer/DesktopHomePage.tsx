import { DiffUrlForm } from '@asahi/app/components/diff-url-form';
import { DiffsHubLogo } from '@asahi/app/components/diffshub-logo';
import { Switch } from '@asahi/app/components/switch';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type {
  DesktopPullRequest,
  DesktopPullRequestReviewDecision,
  DesktopRepository,
  DesktopSelectedRepository,
} from '../shared/githubPullRequests';
import {
  parseSelectedRepositories,
  SELECTED_REPOSITORIES_KEY,
} from '../shared/selectedRepositories';
import type { DesktopViewerTabRequest } from '../shared/desktopTabs';
import {
  listOwnerRepositories,
  listRepositoryOwners,
  listRepositoryPullRequests,
} from './desktopApi';
import Link from './next-link';

type ReviewFilter = 'all' | 'pending-review' | 'approved' | 'changes-requested';
type UpdatedFilter = 'all' | '24h' | '7d' | '30d';

export function DesktopHomePage({
  onOpenViewerTab,
}: {
  onOpenViewerTab: (tab: DesktopViewerTabRequest) => void;
}) {
  const [selectedRepositories, setSelectedRepositories] = useState<
    DesktopSelectedRepository[]
  >(readSelectedRepositories);
  const [repositoryFilter, setRepositoryFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [updatedFilter, setUpdatedFilter] = useState<UpdatedFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const pullRequestsQuery = useQuery({
    queryKey: ['repository-pull-requests', selectedRepositories],
    queryFn: async () => {
      if (selectedRepositories.length === 0) return [];

      const result = await listRepositoryPullRequests({
        repositories: selectedRepositories,
      });
      if (!result.ok) throw new Error(result.message);
      return result.items;
    },
  });

  const saveSelectedRepositories = useCallback(
    (next: DesktopSelectedRepository[]) => {
      setSelectedRepositories(next);
      localStorage.setItem(SELECTED_REPOSITORIES_KEY, JSON.stringify(next));
      if (
        repositoryFilter !== 'all' &&
        next.every(
          (repository) => repository.nameWithOwner !== repositoryFilter
        )
      ) {
        setRepositoryFilter('all');
      }
    },
    [repositoryFilter]
  );

  const filteredItems = useMemo(
    () =>
      (pullRequestsQuery.data ?? [])
        .filter((item) =>
          repositoryFilter === 'all'
            ? true
            : item.repository === repositoryFilter
        )
        .filter((item) =>
          matchesReviewFilter(item.reviewDecision, reviewFilter)
        )
        .filter((item) => matchesUpdatedFilter(item.updatedAt, updatedFilter)),
    [pullRequestsQuery.data, repositoryFilter, reviewFilter, updatedFilter]
  );

  return (
    <main className="bg-[var(--diffshub-sidebar-bg)] text-foreground grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden antialiased select-none">
      <header className="border-border-opaque bg-[var(--diffshub-sidebar-bg)] z-10 flex flex-wrap items-center gap-2.5 border-b px-3 py-1.5 md:flex-nowrap">
        <Link
          href="/"
          className="inline-flex size-10 items-center justify-center rounded-md transition-transform active:scale-[0.96]"
        >
          <DiffsHubLogo />
        </Link>
        <DiffUrlForm
          className="order-last md:order-none md:mr-auto"
          placeholder="https://github.com/org/repo/123"
          inputClassName="w-full md:w-auto"
        />
        <Select
          label="Review filter"
          onChange={(value) => setReviewFilter(value as ReviewFilter)}
          value={reviewFilter}
        >
          <option value="all">All reviews</option>
          <option value="pending-review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="changes-requested">Changes requested</option>
        </Select>
        <Select
          label="Updated filter"
          onChange={(value) => setUpdatedFilter(value as UpdatedFilter)}
          value={updatedFilter}
        >
          <option value="all">All time</option>
          <option value="24h">Updated 24h</option>
          <option value="7d">Updated 7d</option>
          <option value="30d">Updated 30d</option>
        </Select>
        <IconButton
          label="Refresh pull requests"
          loading={pullRequestsQuery.isFetching}
          onClick={() => void pullRequestsQuery.refetch()}
        />
      </header>

      <div className="grid min-h-0 grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-border-opaque bg-[var(--diffshub-sidebar-bg)] min-h-0 border-r">
          <div className="flex items-center gap-2 px-3 py-2">
            <h2 className="mr-auto text-sm font-medium">Repositories</h2>
            <button
              type="button"
              aria-label="Add repository"
              className="hover:bg-accent text-muted-foreground hover:text-foreground flex size-10 items-center justify-center rounded-md transition-[color,background-color,transform] active:scale-[0.96]"
              onClick={() => setDialogOpen(true)}
            >
              <PlusIcon />
            </button>
          </div>
          <nav className="h-[calc(100%-48px)] overflow-auto px-2 pb-2">
            {selectedRepositories.map((repository) => (
              <RepositoryButton
                active={repositoryFilter === repository.nameWithOwner}
                key={repository.nameWithOwner}
                label={repository.nameWithOwner}
                onClick={() =>
                  setRepositoryFilter((current) =>
                    current === repository.nameWithOwner
                      ? 'all'
                      : repository.nameWithOwner
                  )
                }
                onRemove={() =>
                  saveSelectedRepositories(
                    selectedRepositories.filter(
                      (item) => item.nameWithOwner !== repository.nameWithOwner
                    )
                  )
                }
              />
            ))}
          </nav>
        </aside>

        <section className="bg-background min-h-0 overflow-hidden">
          {pullRequestsQuery.isPending && selectedRepositories.length > 0 && (
            <LoadingRows />
          )}
          {pullRequestsQuery.isError && (
            <EmptyState
              action="Try again"
              message={pullRequestsQuery.error.message}
              onAction={() => void pullRequestsQuery.refetch()}
              title="Pull requests unavailable"
            />
          )}
          {!pullRequestsQuery.isError && selectedRepositories.length === 0 && (
            <EmptyState
              action="Add repository"
              message="Select repositories first; PRs load only from that set."
              onAction={() => setDialogOpen(true)}
              title="No repositories selected"
            />
          )}
          {!pullRequestsQuery.isPending &&
            !pullRequestsQuery.isError &&
            selectedRepositories.length > 0 &&
            filteredItems.length === 0 && (
              <EmptyState
                message="Adjust the filters or select another repository."
                title="No matching pull requests"
              />
            )}
          {!pullRequestsQuery.isError && filteredItems.length > 0 && (
            <ul className="divide-border h-full overflow-auto divide-y">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <PullRequestRow
                    item={item}
                    onOpenViewerTab={onOpenViewerTab}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {dialogOpen && (
        <RepositoryDialog
          onClose={() => setDialogOpen(false)}
          onSelectedChange={saveSelectedRepositories}
          selectedRepositories={selectedRepositories}
        />
      )}
    </main>
  );
}

function RepositoryDialog({
  onClose,
  onSelectedChange,
  selectedRepositories,
}: {
  onClose: () => void;
  onSelectedChange: (repositories: DesktopSelectedRepository[]) => void;
  selectedRepositories: DesktopSelectedRepository[];
}) {
  const [ownerKey, setOwnerKey] = useState('');
  const [filter, setFilter] = useState('');
  const ownersQuery = useQuery({
    queryKey: ['repository-owners'],
    queryFn: async () => {
      const result = await listRepositoryOwners();
      if (!result.ok) throw new Error(result.message);
      return result.owners;
    },
  });
  const owners = ownersQuery.data ?? [];
  const owner =
    owners.find((item) => `${item.type}:${item.login}` === ownerKey) ??
    owners[0] ??
    null;
  const repositoriesQuery = useQuery({
    queryKey: ['owner-repositories', owner?.type, owner?.login],
    queryFn: async () => {
      if (owner == null) return [];

      const result = await listOwnerRepositories({
        owner: owner.login,
        ownerType: owner.type,
      });
      if (!result.ok) throw new Error(result.message);
      return result.items;
    },
    enabled: owner != null,
  });
  const repositories = repositoriesQuery.data ?? [];

  useEffect(() => {
    setFilter('');
  }, [owner?.login, owner?.type]);

  const selectedSet = useMemo(
    () =>
      new Set(
        selectedRepositories.map((repository) => repository.nameWithOwner)
      ),
    [selectedRepositories]
  );
  const visibleRepositories = repositories.filter((repository) =>
    repository.name.toLowerCase().includes(filter.toLowerCase())
  );

  function toggleRepository(repository: DesktopRepository) {
    if (selectedSet.has(repository.nameWithOwner)) {
      onSelectedChange(
        selectedRepositories.filter(
          (item) => item.nameWithOwner !== repository.nameWithOwner
        )
      );
      return;
    }

    onSelectedChange([
      ...selectedRepositories,
      {
        owner: repository.owner,
        name: repository.name,
        nameWithOwner: repository.nameWithOwner,
      },
    ]);
  }

  return (
    <div className="bg-background fixed top-1/2 left-1/2 z-50 grid h-[min(560px,calc(100dvh-48px))] w-[min(760px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)] shadow-[0_24px_80px_rgb(0_0_0_/_0.22),0_0_0_1px_rgb(0_0_0_/_0.08)] dark:shadow-[0_24px_80px_rgb(0_0_0_/_0.44),0_0_0_1px_rgb(255_255_255_/_0.1)]">
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <h2 className="mr-auto text-sm font-medium text-balance">
          Add repository
        </h2>
        <button
          type="button"
          aria-label="Close"
          className="hover:bg-accent text-muted-foreground hover:text-foreground flex size-10 items-center justify-center rounded-md transition-[color,background-color,transform] active:scale-[0.96]"
          onClick={onClose}
        >
          <XIcon />
        </button>
      </div>
      <div className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-border min-h-0 overflow-auto border-r p-2">
          {ownersQuery.isPending && (
            <p className="text-muted-foreground px-2 py-2 text-sm">
              Loading owners...
            </p>
          )}
          {ownersQuery.isError && (
            <p className="text-muted-foreground px-2 py-2 text-sm">
              {ownersQuery.error.message}
            </p>
          )}
          {ownersQuery.isSuccess && owners.length === 0 && (
            <p className="text-muted-foreground px-2 py-2 text-sm">
              No owners found.
            </p>
          )}
          {ownersQuery.isSuccess &&
            owners.map((item) => (
              <button
                type="button"
                className={
                  item.login === owner?.login
                    ? 'bg-accent text-foreground grid min-h-10 w-full grid-cols-[24px_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-2 text-left text-sm'
                    : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground grid min-h-10 w-full grid-cols-[24px_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-[color,background-color,transform] active:scale-[0.96]'
                }
                key={`${item.type}:${item.login}`}
                onClick={() => setOwnerKey(`${item.type}:${item.login}`)}
              >
                <img
                  alt=""
                  className="bg-muted size-6 rounded-full outline -outline-offset-1 outline-black/10 dark:outline-white/10"
                  src={item.avatarUrl}
                />
                <span className="truncate">{item.login}</span>
              </button>
            ))}
        </aside>
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
          <div className="p-2">
            <label className="sr-only" htmlFor="repository-filter">
              Filter repositories
            </label>
            <input
              id="repository-filter"
              className="border-border bg-background h-9 w-full rounded-md border px-2 text-sm outline-none"
              onChange={(event) => setFilter(event.currentTarget.value)}
              placeholder="Filter repositories"
              value={filter}
            />
          </div>
          <div className="grid min-h-0 auto-rows-min grid-cols-2 gap-3 overflow-auto p-3">
            {owner != null && repositoriesQuery.isPending && <LoadingStatus />}
            {repositoriesQuery.isError && (
              <p className="text-muted-foreground col-span-full px-1 py-2 text-sm">
                {repositoriesQuery.error.message}
              </p>
            )}
            {repositoriesQuery.isSuccess &&
              visibleRepositories.map((repository) => {
                const selected = selectedSet.has(repository.nameWithOwner);
                return (
                  <div
                    className="border-border hover:bg-accent/60 grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border px-3 py-3 text-left transition-[color,background-color,border-color]"
                    key={repository.id}
                  >
                    <button
                      type="button"
                      className="min-h-10 min-w-0 text-left transition-transform active:scale-[0.96]"
                      onClick={() => toggleRepository(repository)}
                    >
                      <span className="block truncate text-sm">
                        {repository.name}
                      </span>
                    </button>
                    <Switch
                      aria-label={`Select ${repository.name}`}
                      checked={selected}
                      onCheckedChange={() => toggleRepository(repository)}
                    />
                  </div>
                );
              })}
          </div>
        </section>
      </div>
    </div>
  );
}

function LoadingStatus() {
  return (
    <div className="text-muted-foreground col-span-full flex min-h-24 items-center justify-center gap-2 text-sm">
      <SpinnerIcon />
      <span>Loading...</span>
    </div>
  );
}

function RepositoryButton({
  active,
  label,
  onClick,
  onRemove,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={
        active
          ? 'bg-accent text-foreground group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md'
          : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md transition-[color,background-color]'
      }
    >
      <button
        type="button"
        className="min-h-10 min-w-0 px-2 text-left text-sm active:scale-[0.96]"
        onClick={onClick}
      >
        <span className="block truncate">{label}</span>
      </button>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        className="text-muted-foreground hover:text-foreground flex size-10 items-center justify-center rounded-md opacity-0 transition-[color,background-color,opacity,transform] hover:bg-accent group-hover:opacity-100 focus:opacity-100 active:scale-[0.96]"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        <XIcon />
      </button>
    </div>
  );
}

function PullRequestRow({
  item,
  onOpenViewerTab,
}: {
  item: DesktopPullRequest;
  onOpenViewerTab: (tab: DesktopViewerTabRequest) => void;
}) {
  return (
    <button
      type="button"
      className="hover:bg-accent/60 focus-visible:ring-ring grid min-h-[64px] w-full grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-left transition-[color,background-color,transform] focus-visible:ring-2 focus-visible:outline-none active:scale-[0.996]"
      onClick={() =>
        onOpenViewerTab({
          id: item.viewerPath,
          body: item.bodyHTML,
          title: item.title,
          type: 'pr',
          viewerAvatarUrl: item.viewerAvatarUrl,
          owner: item.owner,
          repo: item.repo,
          number: item.number,
        })
      }
    >
      <span className="min-w-0">
        <span className="text-muted-foreground block truncate font-mono text-xs tracking-tight tabular-nums">
          {item.repository} #{item.number}
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-balance">
          {item.title}
        </span>
      </span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {formatDateTime(item.updatedAt)}
      </span>
    </button>
  );
}

function Select({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="hover:bg-accent text-muted-foreground hover:text-foreground h-10 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none transition-[color,background-color]"
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {children}
      </select>
    </>
  );
}

function IconButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="hover:bg-accent text-muted-foreground hover:text-foreground flex size-10 items-center justify-center rounded-md border border-transparent transition-[color,background-color,transform] disabled:opacity-50 active:scale-[0.96]"
      disabled={loading}
      onClick={onClick}
    >
      <svg
        aria-hidden="true"
        className={loading ? 'size-4 animate-spin' : 'size-4'}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}

function EmptyState({
  action,
  message,
  onAction,
  title,
}: {
  action?: string;
  message: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
      <div>
        <h2 className="text-sm font-medium text-balance">{title}</h2>
        <p className="text-muted-foreground mt-1 max-w-md text-sm text-pretty">
          {message}
        </p>
      </div>
      {action != null && onAction != null && (
        <button
          type="button"
          className="hover:bg-accent min-h-10 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium transition-[background-color,transform] active:scale-[0.96]"
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </div>
  );
}

function matchesReviewFilter(
  decision: DesktopPullRequestReviewDecision,
  filter: ReviewFilter
): boolean {
  switch (filter) {
    case 'pending-review':
      return decision === 'REVIEW_REQUIRED';
    case 'approved':
      return decision === 'APPROVED';
    case 'changes-requested':
      return decision === 'CHANGES_REQUESTED';
    case 'all':
      return true;
  }
}

function matchesUpdatedFilter(value: string, filter: UpdatedFilter): boolean {
  if (filter === 'all') return true;

  const updatedAt = Date.parse(value);
  if (Number.isNaN(updatedAt)) return false;

  const hours = filter === '24h' ? 24 : filter === '7d' ? 24 * 7 : 24 * 30;
  return Date.now() - updatedAt <= hours * 60 * 60 * 1000;
}

function readSelectedRepositories(): DesktopSelectedRepository[] {
  return parseSelectedRepositories(
    localStorage.getItem(SELECTED_REPOSITORIES_KEY)
  );
}

function LoadingRows() {
  return (
    <div className="text-muted-foreground flex h-full min-h-64 items-center justify-center gap-2 text-sm">
      <SpinnerIcon />
      <span>Loading...</span>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = Date.now() - date.getTime();

  const seconds = Math.max(0, Math.round(diffMs / 1000));
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.max(0, Math.round(minutes / 60));
  const days = Math.max(0, Math.round(hours / 24));
  const months = Math.max(0, Math.round(days / 30));
  const years = Math.max(0, Math.round(days / 365));

  if (seconds < 5) return 'just now';

  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
  });

  if (seconds < 60) return formatter.format(-seconds, 'second');
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  if (hours < 24) return formatter.format(-hours, 'hour');
  if (days < 30) return formatter.format(-days, 'day');
  if (months < 12) return formatter.format(-months, 'month');
  return formatter.format(-years, 'year');
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
