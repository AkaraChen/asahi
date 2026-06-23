import { ReviewUI } from '@asahi/app/components/review-ui';
import {
  PreloadHighlighter,
  ScrollbarGutterVariables,
  ThemeProvider,
  Toaster,
  WorkerPoolContext,
} from '@asahi/app/layout';
import { resolveDiffshubViewerRoute } from '@asahi/app/lib/resolve-viewer-route';
import { useEffect, useMemo, useState } from 'react';

import { DesktopHomePage } from './DesktopHomePage';
import { navigateDesktop } from './navigation';

interface DesktopLocation {
  domain?: string;
  pathSegments: string[];
  routeKey: string;
}

export function App() {
  return (
    <WorkerPoolContext>
      <ThemeProvider attribute="class">
        <ScrollbarGutterVariables />
        <DesktopRouter />
        <Toaster />
      </ThemeProvider>
      <PreloadHighlighter />
    </WorkerPoolContext>
  );
}

function DesktopRouter() {
  const location = useDesktopLocation();

  if (location.pathSegments.length === 0) {
    return <DesktopHomePage />;
  }

  return <DesktopViewer location={location} />;
}

function DesktopViewer({ location }: { location: DesktopLocation }) {
  const route = useMemo(
    () => resolveDiffshubViewerRoute(location.pathSegments, location.domain),
    [location.domain, location.pathSegments]
  );

  useEffect(() => {
    if (route.kind === 'redirect') {
      navigateDesktop(route.target, { replace: true });
    }
  }, [route]);

  if (route.kind === 'redirect') {
    return null;
  }

  return (
    <div className="flex h-dvh flex-col gap-2">
      <ReviewUI
        key={location.routeKey}
        domain={route.domain}
        initialUrl={route.url}
        path={route.upstreamPath}
      />
    </div>
  );
}

function useDesktopLocation(): DesktopLocation {
  const [href, setHref] = useState(getDesktopHref);

  useEffect(() => {
    const updateHref = () => setHref(getDesktopHref());
    window.addEventListener('hashchange', updateHref);
    window.addEventListener('asahi:navigate', updateHref);
    return () => {
      window.removeEventListener('hashchange', updateHref);
      window.removeEventListener('asahi:navigate', updateHref);
    };
  }, []);

  return useMemo(() => parseDesktopHref(href), [href]);
}

function getDesktopHref(): string {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : '';
  if (hash === '') {
    return '/';
  }
  return hash.startsWith('/') ? hash : `/${hash}`;
}

function parseDesktopHref(href: string): DesktopLocation {
  const url = new URL(href, 'https://desktop.local');
  const pathSegments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const domain = url.searchParams.get('domain') ?? undefined;
  return {
    domain,
    pathSegments,
    routeKey: `${url.pathname}?${url.searchParams.toString()}`,
  };
}
