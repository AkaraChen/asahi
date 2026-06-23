import { createThemeCatalog } from '@pierre/theming';
import { themes } from '@pierre/theming/themes';

export const docsThemeCatalog = createThemeCatalog({
  themes,
  defaultLightThemeName: 'vitesse-light',
  defaultDarkThemeName: 'vitesse-dark',
});
