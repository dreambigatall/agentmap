# Notes for coding agents

## UI components: ui-sdk

The web app (`apps/web`) builds its interface with [ui-sdk](https://ui-sdk.dev) (`@ui-sdk/react` and `@ui-sdk/core`).

- Before using ui-sdk, follow the ui-sdk skill if it's installed, and read
  `apps/web/node_modules/@ui-sdk/react/docs/llms.txt`.
- To build a new component, also search `apps/web/node_modules/@ui-sdk/react/docs/core.md` by heading,
  and read `rendering.md` next to it. The skill also ships at
  `apps/web/node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md`.
- Components are unstyled. Style them with Tailwind using their `data-*` state attributes
  (`data-highlighted`, `data-invalid`, `data-pending`, ...) and the design tokens in
  `apps/web/src/app/globals.css`. Never use raw colours.
- Screens use the styled wrappers in `apps/web/src/components/ui/`, not ui-sdk parts directly.
  Add a wrapper there when a new kind of control is needed.
- Confirmations and notifications go through `ask()` and `notify` in
  `apps/web/src/components/ui/overlays.tsx`. Never use `window.confirm` or `alert`.
- The version is pinned exactly (it is a beta). Read the shipped docs, not the website,
  when they disagree.

## Shared rules

- Input rules live once, as Zod schemas in `packages/shared`, and are used by both the API and the web app.
- Every route under `/api/w/:workspaceId` must be listed in `apps/api/test/isolation.e2e-spec.ts`.
- Database tables live in the `app` schema, never `public`.
