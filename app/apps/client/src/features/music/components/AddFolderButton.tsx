import { FolderPlus, Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { isTauri } from '../../../utils/isTauri'
import { useAddFolder } from '../hooks'

export function AddFolderButton() {
  const { t } = useTranslation('music')
  const addFolder = useAddFolder()
  const [isSelecting, setIsSelecting] = useState(false)

  const handleAddFolder = useCallback(async () => {
    if (!isTauri()) {
      return
    }

    setIsSelecting(true)
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')

      const selectedFolder = await open({
        directory: true,
        multiple: false,
        title: t('folders.addDescription'),
      })

      if (typeof selectedFolder === 'string') {
        await addFolder.mutateAsync({ path: selectedFolder })
      }
    } finally {
      setIsSelecting(false)
    }
  }, [addFolder, t])

  const isLoading = isSelecting || addFolder.isPending

  return (
    <Button
      onClick={handleAddFolder}
      disabled={isLoading || !isTauri()}
      className="shrink-0"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
      ) : (
        <FolderPlus className="h-4 w-4 sm:mr-2" />
      )}
      <span className="hidden sm:inline">{t('folders.add')}</span>
    </Button>
  )
}
