import { Clapperboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '~/ui/page'
import { LivestreamGuideButton } from './guide/LivestreamGuideButton'
import { SceneCard } from './SceneCard'
import { useOBSConnection, useOBSScenes } from '../hooks'

export function SceneGrid() {
  const { t } = useTranslation('livestream')
  const { scenes, isLoading, switchScene } = useOBSScenes()
  const { isConnected } = useOBSConnection()

  const visibleScenes = scenes.filter((s) => s.isVisible)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/*<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">*/}
      {/*  {t('scenes.title')}*/}
      {/*</h2>*/}
      {visibleScenes.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title={t('scenes.noScenes')}
          action={<LivestreamGuideButton variant="primary" />}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleScenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              onSwitch={switchScene}
              isOBSConnected={isConnected}
            />
          ))}
        </div>
      )}
    </div>
  )
}
