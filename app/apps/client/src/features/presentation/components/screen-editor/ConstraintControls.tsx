import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox/Combobox'
import { Input } from '~/ui/input/Input'
import { Label } from '~/ui/label/Label'
import type { Constraints, PositionUnit, SizeWithUnits } from '../../types'

interface ConstraintControlsProps {
  constraints: Constraints
  size: SizeWithUnits
  onChange: (constraints: Constraints, size: SizeWithUnits) => void
}

const UNIT_OPTIONS = [
  { value: '%', label: '%' },
  { value: 'px', label: 'px' },
]

export function ConstraintControls({
  constraints,
  size,
  onChange,
}: ConstraintControlsProps) {
  const { t } = useTranslation('presentation')

  const updateConstraint = (
    edge: keyof Constraints,
    newConstraint: Constraint,
  ) => {
    onChange({ ...constraints, [edge]: newConstraint }, size)
  }

  const updateSize = (updates: Partial<SizeWithUnits>) => {
    onChange(constraints, { ...size, ...updates })
  }

  const isHorizontalStretch =
    constraints.left.enabled && constraints.right.enabled
  const isVerticalStretch =
    constraints.top.enabled && constraints.bottom.enabled

  return (
    <div className="space-y-4">
      {/* Visual constraint indicator */}
      <div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
        {/* Center box representing the element */}
        <div className="absolute inset-8 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded flex items-center justify-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('screens.position.element', 'Element')}
          </span>
        </div>

        {/* Top anchor indicator */}
        <button
          type="button"
          onClick={() =>
            updateConstraint('top', {
              ...constraints.top,
              enabled: !constraints.top.enabled,
            })
          }
          className={`
            absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2
            transition-all duration-150
            ${
              constraints.top.enabled
                ? 'bg-indigo-600 border-indigo-600'
                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
            }
          `}
          title={t('screens.position.top', 'Top')}
        />
        {constraints.top.enabled && (
          <div className="absolute top-7 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white/90 dark:bg-gray-900/90 rounded overflow-hidden">
            <input
              type="number"
              value={constraints.top.value}
              onChange={(e) =>
                updateConstraint('top', {
                  ...constraints.top,
                  value: parseFloat(e.target.value) || 0,
                })
              }
              className="w-10 h-5 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-transparent px-1 text-center border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                updateConstraint('top', {
                  ...constraints.top,
                  unit: constraints.top.unit === '%' ? 'px' : '%',
                })
              }}
              className="h-5 px-1 text-[10px] text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
            >
              {constraints.top.unit}
            </button>
          </div>
        )}

        {/* Bottom anchor indicator */}
        <button
          type="button"
          onClick={() =>
            updateConstraint('bottom', {
              ...constraints.bottom,
              enabled: !constraints.bottom.enabled,
            })
          }
          className={`
            absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2
            transition-all duration-150
            ${
              constraints.bottom.enabled
                ? 'bg-indigo-600 border-indigo-600'
                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
            }
          `}
          title={t('screens.position.bottom', 'Bottom')}
        />
        {constraints.bottom.enabled && (
          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white/90 dark:bg-gray-900/90 rounded overflow-hidden">
            <input
              type="number"
              value={constraints.bottom.value}
              onChange={(e) =>
                updateConstraint('bottom', {
                  ...constraints.bottom,
                  value: parseFloat(e.target.value) || 0,
                })
              }
              className="w-10 h-5 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-transparent px-1 text-center border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                updateConstraint('bottom', {
                  ...constraints.bottom,
                  unit: constraints.bottom.unit === '%' ? 'px' : '%',
                })
              }}
              className="h-5 px-1 text-[10px] text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
            >
              {constraints.bottom.unit}
            </button>
          </div>
        )}

        {/* Left anchor indicator */}
        <button
          type="button"
          onClick={() =>
            updateConstraint('left', {
              ...constraints.left,
              enabled: !constraints.left.enabled,
            })
          }
          className={`
            absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2
            transition-all duration-150
            ${
              constraints.left.enabled
                ? 'bg-indigo-600 border-indigo-600'
                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
            }
          `}
          title={t('screens.position.left', 'Left')}
        />
        {constraints.left.enabled && (
          <div className="absolute left-7 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white/90 dark:bg-gray-900/90 rounded overflow-hidden">
            <input
              type="number"
              value={constraints.left.value}
              onChange={(e) =>
                updateConstraint('left', {
                  ...constraints.left,
                  value: parseFloat(e.target.value) || 0,
                })
              }
              className="w-10 h-5 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-transparent px-1 text-center border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                updateConstraint('left', {
                  ...constraints.left,
                  unit: constraints.left.unit === '%' ? 'px' : '%',
                })
              }}
              className="h-5 px-1 text-[10px] text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
            >
              {constraints.left.unit}
            </button>
          </div>
        )}

        {/* Right anchor indicator */}
        <button
          type="button"
          onClick={() =>
            updateConstraint('right', {
              ...constraints.right,
              enabled: !constraints.right.enabled,
            })
          }
          className={`
            absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2
            transition-all duration-150
            ${
              constraints.right.enabled
                ? 'bg-indigo-600 border-indigo-600'
                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
            }
          `}
          title={t('screens.position.right', 'Right')}
        />
        {constraints.right.enabled && (
          <div className="absolute right-7 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white/90 dark:bg-gray-900/90 rounded overflow-hidden">
            <input
              type="number"
              value={constraints.right.value}
              onChange={(e) =>
                updateConstraint('right', {
                  ...constraints.right,
                  value: parseFloat(e.target.value) || 0,
                })
              }
              className="w-10 h-5 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-transparent px-1 text-center border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                updateConstraint('right', {
                  ...constraints.right,
                  unit: constraints.right.unit === '%' ? 'px' : '%',
                })
              }}
              className="h-5 px-1 text-[10px] text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
            >
              {constraints.right.unit}
            </button>
          </div>
        )}

        {/* Lines connecting enabled anchors to center box */}
        {constraints.top.enabled && (
          <div className="absolute top-6 left-1/2 w-0.5 h-2 bg-indigo-600 -translate-x-1/2" />
        )}
        {constraints.bottom.enabled && (
          <div className="absolute bottom-6 left-1/2 w-0.5 h-2 bg-indigo-600 -translate-x-1/2" />
        )}
        {constraints.left.enabled && (
          <div className="absolute left-6 top-1/2 h-0.5 w-2 bg-indigo-600 -translate-y-1/2" />
        )}
        {constraints.right.enabled && (
          <div className="absolute right-6 top-1/2 h-0.5 w-2 bg-indigo-600 -translate-y-1/2" />
        )}
      </div>

      {/* Size inputs (hidden when stretch mode is active) */}
      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        {!isHorizontalStretch && (
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">
              {t('screens.position.width', 'Width')}
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                value={size.width}
                onChange={(e) =>
                  updateSize({ width: parseFloat(e.target.value) || 0 })
                }
                className="h-8 flex-1"
              />
              <Combobox
                value={size.widthUnit}
                onChange={(value) =>
                  updateSize({ widthUnit: value as PositionUnit })
                }
                options={UNIT_OPTIONS}
                className="w-16 h-8"
              />
            </div>
          </div>
        )}
        {isHorizontalStretch && (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
            {t(
              'screens.position.stretchHorizontal',
              'Width stretches between left and right constraints',
            )}
          </div>
        )}

        {!isVerticalStretch && (
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">
              {t('screens.position.height', 'Height')}
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                value={size.height}
                onChange={(e) =>
                  updateSize({ height: parseFloat(e.target.value) || 0 })
                }
                className="h-8 flex-1"
              />
              <Combobox
                value={size.heightUnit}
                onChange={(value) =>
                  updateSize({ heightUnit: value as PositionUnit })
                }
                options={UNIT_OPTIONS}
                className="w-16 h-8"
              />
            </div>
          </div>
        )}
        {isVerticalStretch && (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
            {t(
              'screens.position.stretchVertical',
              'Height stretches between top and bottom constraints',
            )}
          </div>
        )}
      </div>
    </div>
  )
}
