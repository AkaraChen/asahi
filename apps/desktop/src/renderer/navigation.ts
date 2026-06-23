interface NavigateOptions {
  replace?: boolean;
}

export function navigateDesktop(href: string, options: NavigateOptions = {}) {
  const hash = toDesktopHash(href);
  if (options.replace === true) {
    window.history.replaceState(window.history.state, '', hash);
    window.dispatchEvent(new Event('asahi:navigate'));
    return;
  }

  if (window.location.hash === hash) {
    window.dispatchEvent(new Event('asahi:navigate'));
    return;
  }

  window.location.hash = hash.slice(1);
}

export function toDesktopHref(href: string): string {
  if (isExternalHref(href) || href.startsWith('#')) {
    return href;
  }

  return toDesktopHash(href);
}

export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(href);
}

function toDesktopHash(href: string): `#/${string}` {
  const normalizedHref = href.startsWith('/') ? href : `/${href}`;
  return `#${normalizedHref}` as `#/${string}`;
}
