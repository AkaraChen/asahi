import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

import { isExternalHref, navigateDesktop, toDesktopHref } from './navigation';

interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string | URL;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  children?: ReactNode;
}

export default function Link({
  href,
  onClick,
  replace,
  target,
  ...props
}: LinkProps) {
  const rawHref = String(href);
  const renderedHref = toDesktopHref(rawHref);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === '_blank' ||
      isExternalHref(rawHref)
    ) {
      return;
    }

    event.preventDefault();
    navigateDesktop(rawHref, { replace });
  }

  return (
    <a {...props} href={renderedHref} onClick={handleClick} target={target} />
  );
}
