import { DiffUrlForm } from '@asahi/app/components/diff-url-form';
import { DiffsHubLogo } from '@asahi/app/components/diffshub-logo';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  DesktopPullRequest,
  DesktopPullRequestReviewDecision,
} from '../shared/githubPullRequests';
import { navigateDesktop } from './navigation';
import Link from './next-link';

type PullRequestState =
  | { status: 'loading' }
  | {
      status: 'ready';
      items: DesktopPullRequest[];
      fetchedAt: string;
    }
  | {
      status: 'error';
      message: string;
    };

type ReviewFilter = 'all' | 'pending-review' | 'approved' | 'changes-requested';
type UpdatedFilter = 'all' | '24h' | '7d' | '30d';

export function DesktopHomePage() {
  const [state, setState] = useState<PullRequestState>({ status: 'loading' });
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [updatedFilter, setUpdatedFilter] = useState<UpdatedFilter>('30d');

  const loadPullRequests = useCallback(async () => {
    setState({ status: 'loading' });
    const result = await window.asahi.listMergeablePullRequests();
    if (result.ok) {
      setState({
        status: 'ready',
        items: result.items,
        fetchedAt: result.fetchedAt,
      });
      return;
    }

    setState({
      status: 'error',
      message: result.message,
    });
  }, []);

  useEffect(() => {
    void loadPullRequests();
  }, [loadPullRequests]);

  const filteredItems = useMemo(
    () =>
      state.status === 'ready'
        ? state.items.filter((item) =>
            matchesReviewFilter(item.reviewDecision, reviewFilter)
          ).filter((item) => matchesUpdatedFilter(item.updatedAt, updatedFilter))
        : [],
    [reviewFilter, state, updatedFilter]
  );

  return (
    <main className="bg-[var(--diffshub-sidebar-bg)] text-foreground grid h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <header className="border-border-opaque bg-[var(--diffshub-sidebar-bg)] z-10 flex flex-wrap items-center gap-2.5 border-b px-3 py-1.5 md:flex-nowrap">
        <Link
          href="/"
          className="inline-flex transition-transform duration-200 hover:scale-110"
        >
          <DiffsHubLogo />
        </Link>
        <DiffUrlForm
          className="order-last md:order-none md:mr-auto"
          placeholder="https://github.com/org/repo/123"
          inputClassName="w-full md:w-auto"
        />
        <label className="sr-only" htmlFor="review-filter">
          Review filter
        </label>
        <select
          id="review-filter"
          className="hover:bg-accent text-muted-foreground hover:text-foreground h-9 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none transition-colors"
          value={reviewFilter}
          onChange={(event) =>
            setReviewFilter(event.currentTarget.value as ReviewFilter)
          }
        >
          <option value="all">All reviews</option>
          <option value="pending-review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="changes-requested">Changes requested</option>
        </select>
        <label className="sr-only" htmlFor="updated-filter">
          Updated filter
        </label>
        <select
          id="updated-filter"
          className="hover:bg-accent text-muted-foreground hover:text-foreground h-9 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none transition-colors"
          value={updatedFilter}
          onChange={(event) =>
            setUpdatedFilter(event.currentTarget.value as UpdatedFilter)
          }
        >
          <option value="24h">Updated 24h</option>
          <option value="7d">Updated 7d</option>
          <option value="30d">Updated 30d</option>
          <option value="all">All time</option>
        </select>
        <button
          type="button"
          aria-label="Refresh pull requests"
          className="hover:bg-accent text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-md border border-transparent transition-colors disabled:opacity-50"
          disabled={state.status === 'loading'}
          onClick={() => void loadPullRequests()}
        >
          <svg
            aria-hidden="true"
            className={
              state.status === 'loading' ? 'size-4 animate-spin' : 'size-4'
            }
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
      </header>

      <section className="bg-background min-h-0 overflow-hidden">
        {state.status === 'loading' && <LoadingRows />}
        {state.status === 'error' && (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
            <div>
              <h2 className="text-sm font-medium">Pull requests unavailable</h2>
              <p className="text-muted-foreground mt-1 max-w-md text-sm">
                {state.message}
              </p>
            </div>
            <button
              type="button"
              className="hover:bg-accent rounded-md border border-transparent px-3 py-1.5 text-sm font-medium transition-colors"
              onClick={() => void loadPullRequests()}
            >
              Try again
            </button>
          </div>
        )}
        {state.status === 'ready' && filteredItems.length === 0 && (
          <div className="flex h-full min-h-64 items-center justify-center px-6 text-center">
            <div>
              <h2 className="text-sm font-medium">No matching pull requests</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Adjust the filters or paste a PR into the toolbar.
              </p>
            </div>
          </div>
        )}
        {state.status === 'ready' && filteredItems.length > 0 && (
          <ul className="divide-border h-full overflow-auto divide-y">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <PullRequestRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function PullRequestRow({ item }: { item: DesktopPullRequest }) {
  return (
    <button
      type="button"
      className="hover:bg-accent/60 focus-visible:ring-ring grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
      onClick={() => navigateDesktop(item.viewerPath)}
    >
      <span className="min-w-0">
        <span className="text-muted-foreground block truncate font-mono text-xs tracking-tight">
          {item.repository} #{item.number}
        </span>
        <span className="mt-1 block truncate text-sm font-medium">
          {item.title}
        </span>
      </span>
      <span className="text-muted-foreground shrink-0 text-xs">
        <span>{formatDateTime(item.updatedAt)}</span>
      </span>
    </button>
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

function LoadingRows() {
  return (
    <div className="divide-border divide-y">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="px-4 py-3" key={index}>
          <div className="bg-muted h-3 w-36 animate-pulse rounded-sm" />
          <div className="bg-muted mt-3 h-4 max-w-xl animate-pulse rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
