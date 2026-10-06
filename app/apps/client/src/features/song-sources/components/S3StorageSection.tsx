import { Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/ui/input'
import { useToast } from '~/ui/toast'
import { primaryButton } from './buttonStyles'
import { SectionHeading } from './SectionHeading'
import { useS3Storage, useSaveS3Storage } from '../hooks/useS3Storage'
import type { S3StorageInput } from '../types'

const EMPTY: S3StorageInput = {
  endpoint: '',
  region: '',
  bucket: '',
  pathPrefix: 'church-hub',
  accessKeyId: '',
  secretAccessKey: '',
  publicBaseUrl: '',
}

type Field = keyof S3StorageInput

/** The fields in form order: [field, input type, required]. */
const FIELDS: Array<[Field, string, boolean]> = [
  ['endpoint', 'url', true],
  ['region', 'text', false],
  ['bucket', 'text', true],
  ['pathPrefix', 'text', false],
  ['accessKeyId', 'text', true],
  ['secretAccessKey', 'password', false],
  ['publicBaseUrl', 'url', true],
]

/** The user's S3-compatible bucket, where shared categories are published. */
export function S3StorageSection() {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const { data: storage } = useS3Storage()
  const saveStorage = useSaveS3Storage()
  const [form, setForm] = useState<S3StorageInput>(EMPTY)

  useEffect(() => {
    if (storage) setForm({ ...storage, secretAccessKey: '' })
  }, [storage])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveStorage.mutateAsync(form)
      showToast(t('songSources.storage.saved'), 'success')
    } catch (error) {
      showToast(
        t('songSources.storage.saveFailed', {
          error: (error as Error).message,
        }),
        'error',
      )
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        title={t('songSources.storage.title')}
        description={t('songSources.storage.description')}
      />
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELDS.map(([field, type, required]) => (
            <label key={field} className="block space-y-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t(`songSources.storage.${field}`)}
              </span>
              <Input
                type={type}
                required={
                  field === 'secretAccessKey' ? !storage?.hasSecret : required
                }
                value={form[field] ?? ''}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                placeholder={
                  field === 'secretAccessKey' && storage?.hasSecret
                    ? t('songSources.storage.secretKept')
                    : t(`songSources.storage.placeholder.${field}`)
                }
                autoComplete="off"
              />
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={saveStorage.isPending}
          className={primaryButton}
        >
          {saveStorage.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('songSources.storage.save')}
        </button>
      </form>
    </section>
  )
}
