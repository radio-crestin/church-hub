import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  useDeleteHighlightColor,
  useHighlightColors,
  useUpsertHighlightColor,
} from '../../hooks/useHighlightColors'

interface HighlightColorManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function HighlightColorManager({
  isOpen,
  onClose,
}: HighlightColorManagerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { data: colors = [], isLoading } = useHighlightColors()
  const upsertMutation = useUpsertHighlightColor()
  const deleteMutation = useDeleteHighlightColor()

  const [newColorName, setNewColorName] = useState('')
  const [newColorValue, setNewColorValue] = useState('#FFEB3B')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingColor, setEditingColor] = useState('')

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  const handleAddColor = async () => {
    if (!newColorName.trim() || !newColorValue) return

    await upsertMutation.mutateAsync({
      name: newColorName.trim(),
      color: newColorValue,
    })

    setNewColorName('')
    setNewColorValue('#FFEB3B')
  }

  const handleUpdateColor = async () => {
    if (!editingId || !editingName.trim() || !editingColor) return

    await upsertMutation.mutateAsync({
      id: editingId,
      name: editingName.trim(),
      color: editingColor,
    })

    setEditingId(null)
    setEditingName('')
    setEditingColor('')
  }

  const handleDeleteColor = async (id: number) => {
    await deleteMutation.mutateAsync(id)
  }

  const startEditing = (id: number, name: string, color: string) => {
    setEditingId(id)
    setEditingName(name)
    setEditingColor(color)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName('')
    setEditingColor('')
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClick={handleBackdropClick}
      className="fixed inset-0 m-auto w-full max-w-md p-0 rounded-lg bg-white dark:bg-gray-800 backdrop:bg-black/50"
    >
      <div className="flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Manage Highlight Colors
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : (
            <>
              {/* Existing colors */}
              <div className="space-y-2">
                {colors.map((color) => (
                  <div
                    key={color.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-900"
                  >
                    {editingId === color.id ? (
                      <>
                        <input
                          type="color"
                          value={editingColor}
                          onChange={(e) => setEditingColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          placeholder="Color name"
                        />
                        <button
                          type="button"
                          onClick={handleUpdateColor}
                          disabled={upsertMutation.isPending}
                          className="px-2 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: color.color }}
                        />
                        <span className="flex-1 text-sm text-gray-900 dark:text-white">
                          {color.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            startEditing(color.id, color.name, color.color)
                          }
                          className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteColor(color.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add new color */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Add New Color
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newColorValue}
                    onChange={(e) => setNewColorValue(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    placeholder="Color name (e.g., Orange)"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddColor}
                    disabled={
                      upsertMutation.isPending || !newColorName.trim()
                    }
                    className="inline-flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {upsertMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    Add
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}
