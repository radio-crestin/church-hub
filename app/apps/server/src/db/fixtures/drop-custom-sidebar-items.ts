interface SidebarConfiguration {
  items?: { type?: string }[]
}

/**
 * The sidebar layout without the links someone added on their own machine
 * (custom items, e.g. our WhatsApp page): those are theirs, not a default.
 */
export function dropCustomSidebarItems(configuration: unknown): unknown {
  const { items } = configuration as SidebarConfiguration
  if (!Array.isArray(items)) return configuration
  return {
    ...(configuration as object),
    items: items.filter((item) => item.type !== 'custom'),
  }
}
