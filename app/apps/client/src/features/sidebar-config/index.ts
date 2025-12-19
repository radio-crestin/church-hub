// Components
export {
  CustomPageFormModal,
  CustomPageView,
  IconPicker,
  SidebarConfigManager,
  SidebarItemCard,
} from './components'
// Constants
export {
  AVAILABLE_ICONS,
  type AvailableIconName,
  BUILTIN_ITEMS,
  DEFAULT_SIDEBAR_CONFIG,
  SIDEBAR_CONFIG_KEY,
} from './constants'
// Hooks
export {
  getIconComponent,
  SIDEBAR_CONFIG_QUERY_KEY,
  useResolvedSidebarItems,
  useSidebarConfig,
} from './hooks'
// Service
export {
  destroyAllCustomPageWebviews,
  forceCloseAllCustomPageWebviews,
  generateCustomPageId,
  getCustomPagePermission,
  getSidebarConfiguration,
  hideAllCustomPageWebviews,
  hideCurrentWebview,
  saveSidebarConfiguration,
  updateCurrentWebviewBounds,
} from './service'
// Types
export type {
  BuiltInItemDefinition,
  BuiltInMenuItem,
  BuiltInMenuItemId,
  CustomPageInput,
  CustomPageMenuItem,
  ResolvedMenuItem,
  SidebarConfiguration,
  SidebarMenuItem,
} from './types'
