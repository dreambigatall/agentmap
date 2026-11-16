import { createColorScheme, createLocalStorage } from '@ui-sdk/core';

/**
 * The person's theme: System (follow the computer), Dark or Light. Saved in this
 * browser and put on <html data-color-scheme> before the page paints; globals.css
 * picks the colours from that attribute. Dark is the default look.
 */
export const colorScheme = createColorScheme({
  storage: createLocalStorage('skillflow-color-scheme'),
  defaultValue: 'dark',
  global: true,
});

export const THEME_LABEL = { system: 'System', dark: 'Dark', light: 'Light' } as const;
