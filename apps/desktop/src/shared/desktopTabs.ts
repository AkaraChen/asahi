import { z } from 'zod';

export const DESKTOP_OPEN_VIEWER_TAB_CHANNEL = 'asahi:open-viewer-tab';
export const DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL =
  'asahi:get-viewer-tab-request';
export const DESKTOP_SELECT_TAB_CHANNEL = 'asahi:select-tab';
export const DESKTOP_CLOSE_VIEWER_TAB_CHANNEL = 'asahi:close-viewer-tab';

export const DESKTOP_HOME_TAB_ID = 'home';
export const DESKTOP_TAB_BAR_HEIGHT = 36;

const nonEmptyString = z.string().min(1);

export const DesktopTabIdSchema = nonEmptyString;

export const DesktopViewerPrTabRequestSchema = z.object({
  id: DesktopTabIdSchema,
  type: z.literal('pr'),
  owner: nonEmptyString,
  repo: nonEmptyString,
  number: z.number().int().positive(),
  body: z.string().optional(),
  title: z.string().optional(),
  viewerAvatarUrl: z.url().optional(),
});

export const DesktopViewerTabRequestSchema = DesktopViewerPrTabRequestSchema;

export const DesktopSelectTabRequestSchema = z.object({
  id: DesktopTabIdSchema,
});

export type DesktopViewerPrTabRequest = z.infer<
  typeof DesktopViewerPrTabRequestSchema
>;
export type DesktopViewerTabRequest = z.infer<
  typeof DesktopViewerTabRequestSchema
>;
export type DesktopSelectTabRequest = z.infer<
  typeof DesktopSelectTabRequestSchema
>;

export function getViewerTabPath(tab: DesktopViewerTabRequest): string {
  switch (tab.type) {
    case 'pr':
      return `/${tab.owner}/${tab.repo}/pull/${tab.number}`;
    default:
      throw new Error(`Unsupported tab type: ${tab.type}`);
  }
}
