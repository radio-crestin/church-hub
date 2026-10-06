# Page layout standard
How a top-level page in the client is laid out, and the shared components that do it.
Open it when you add a page or change how one looks.

The standard is taken from the pages most of the app already follows (Songs, Bible, Music). The components live in `app/apps/client/src/ui/page/`.

```tsx
<Page>
  <PageHeader title={t('title')} description={t('description')} actions={…} />
  <PagePanel>
    {items.length === 0 ? <EmptyState icon={Bell} title={…} hint={…} /> : items}
  </PagePanel>
</Page>
```

- **`Page`**: the page wrapper. Header, then content, `gap-4` apart; it fills the window on a large screen. Don't add padding: the app layout (`ui/layout/app-layout.tsx`) already pads every page.
- **`PageHeader`**: one row. The title (`text-2xl font-bold`) goes on the left, with an optional one-line description under it. Actions go on the right, in this order: the primary button (indigo), the secondary buttons (gray), then an `ActionMenu` (`ui/menu`). Titles have no icon.
- **`PagePanel`**: the surface the content sits on, like the songs list: a white or dark-gray bordered `rounded-lg` panel that scrolls inside on a large screen. Cards in it are `rounded-lg border`, `bg-white dark:bg-gray-800`, the same as `SongCard`.
- **`EmptyState`**: what a list shows while it is empty: a dashed card with an icon, a line, and a hint, and optionally one action button under it.
- Full width: pages have no `max-w-*`.
- Pages built from movable panels use `Workspace` (`features/workspace`) as their content in place of `PagePanel`. Settings pages keep their own shell, `SettingsLayout`, with `SettingsSection`.
