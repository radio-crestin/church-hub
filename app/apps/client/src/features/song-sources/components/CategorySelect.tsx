import { useCategories } from '~/features/songs/hooks'

interface CategorySelectProps {
  id: string
  value: number | null
  onChange: (categoryId: number | null) => void
  placeholder: string
}

/** A native select of the song categories, for picking one to share. */
export function CategorySelect({
  id,
  value,
  onChange,
  placeholder,
}: CategorySelectProps) {
  const { data: categories = [] } = useCategories()

  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-64"
    >
      <option value="">{placeholder}</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  )
}
