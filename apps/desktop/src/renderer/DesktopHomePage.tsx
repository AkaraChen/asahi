import { getPatchViewerHref } from '@asahi/app/lib/get-patch-viewer-href';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import type { DesktopPullRequestNotification } from '../shared/githubNotifications';
import { navigateDesktop } from './navigation';

type NotificationState =
  | { status: 'loading' }
  | {
      status: 'ready';
      items: DesktopPullRequestNotification[];
      fetchedAt: string;
    }
  | {
      status: 'error';
      message: string;
    };

export function DesktopHomePage() {
  const [state, setState] = useState<NotificationState>({ status: 'loading' });
  const [manualURL, setManualURL] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setState({ status: 'loading' });
    const result = await window.asahi.listPullRequestNotifications();
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
    void loadNotifications();
  }, [loadNotifications]);

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const href = getPatchViewerHref(manualURL);
    if (href == null) {
      setManualError('Enter a GitHub PR URL or owner/repo#123.');
      return;
    }

    setManualError(null);
    navigateDesktop(href);
  }

  return (
    <main className="bg-background text-foreground flex h-dvh min-h-0 flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">Pull Requests</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {state.status === 'ready'
              ? `${state.items.length} unread notifications · ${formatDateTime(state.fetchedAt)}`
              : 'GitHub notifications'}
          </p>
        </div>
        <button
          type="button"
          className="border-border hover:bg-accent rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
          disabled={state.status === 'loading'}
          onClick={() => void loadNotifications()}
        >
          Refresh
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-5">
        <ManualPullRequestForm
          error={manualError}
          onSubmit={handleManualSubmit}
          onURLChange={(value) => {
            setManualURL(value);
            if (manualError != null) setManualError(null);
          }}
          url={manualURL}
        />

        <section className="border-border min-h-0 flex-1 overflow-hidden rounded-lg border">
          {state.status === 'loading' && <LoadingRows />}
          {state.status === 'error' && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
              <div>
                <h2 className="text-sm font-medium">Notifications unavailable</h2>
                <p className="text-muted-foreground mt-1 max-w-md text-sm">
                  {state.message}
                </p>
              </div>
              <button
                type="button"
                className="bg-primary text-primary-foreground hover:opacity-90 rounded-md px-3 py-1.5 text-sm font-medium transition-opacity"
                onClick={() => void loadNotifications()}
              >
                Try again
              </button>
            </div>
          )}
          {state.status === 'ready' && state.items.length === 0 && (
            <div className="flex h-full min-h-64 items-center justify-center px-6 text-center">
              <div>
                <h2 className="text-sm font-medium">No unread PR notifications</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Paste a PR above to open it directly.
                </p>
              </div>
            </div>
          )}
          {state.status === 'ready' && state.items.length > 0 && (
            <ul className="divide-border h-full overflow-auto divide-y">
              {state.items.map((item) => (
                <li key={item.id}>
                  <PullRequestRow item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function ManualPullRequestForm({
  error,
  onSubmit,
  onURLChange,
  url,
}: {
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onURLChange: (value: string) => void;
  url: string;
}) {
  return (
    <form className="flex flex-col gap-2" noValidate onSubmit={onSubmit}>
      <div className="border-border bg-card flex items-center overflow-hidden rounded-lg border">
        <input
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
          enterKeyHint="go"
          onChange={(event) => onURLChange(event.currentTarget.value)}
          placeholder="owner/repo#123 or GitHub PR URL"
          spellCheck={false}
          type="text"
          value={url}
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground mr-1 rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={url.trim().length === 0}
        >
          Open
        </button>
      </div>
      {error != null && <p className="text-destructive px-1 text-xs">{error}</p>}
    </form>
  );
}

function PullRequestRow({ item }: { item: DesktopPullRequestNotification }) {
  return (
    <button
      type="button"
      className="hover:bg-accent/60 focus-visible:ring-ring grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
      onClick={() => navigateDesktop(item.viewerPath)}
    >
      <span className="min-w-0">
        <span className="text-muted-foreground block truncate text-xs">
          {item.repository} #{item.number}
        </span>
        <span className="mt-1 block truncate text-sm font-medium">{item.title}</span>
      </span>
      <span className="text-muted-foreground flex shrink-0 flex-col items-end gap-1 text-xs">
        <span>{formatReason(item.reason)}</span>
        <span>{formatDateTime(item.updatedAt)}</span>
      </span>
    </button>
  );
}

function LoadingRows() {
  return (
    <div className="divide-border divide-y">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="px-4 py-3" key={index}>
          <div className="bg-muted h-3 w-36 animate-pulse rounded" />
          <div className="bg-muted mt-3 h-4 max-w-xl animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

function formatReason(reason: string): string {
  if (reason === '') {
    return 'notification';
  }
  return reason.replace(/_/g, ' ');
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
