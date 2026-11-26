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
      className="w-full min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-fg focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus sm:w-64"
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
