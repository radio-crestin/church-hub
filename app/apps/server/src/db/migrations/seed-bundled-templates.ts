import type { Database } from 'bun:sqlite'
import { BUNDLED_TEMPLATES } from '../../service/slide-templates/bundledTemplates'

/**
 * Writes the designs that ship with the app into slide_templates, on every
 * start: a new version's improved bundled design reaches every install, and
 * the church's own templates are never touched.
 */
export function seedBundledTemplates(db: Database): void {
  BUNDLED_TEMPLATES.forEach((bundled, index) => {
    const design = bundled.design()
    const values = [
      bundled.name,
      design.width,
      design.height,
      JSON.stringify(design.layouts),
      JSON.stringify(design.globalSettings),
      JSON.stringify(design.nextSlide),
      index,
      bundled.key,
    ]
    const existing = db
      .query<{ id: number }, [string]>(
        'SELECT id FROM slide_templates WHERE bundled_key = ?',
      )
      .get(bundled.key)
    if (existing) {
      db.run(
        `UPDATE slide_templates SET name = ?, width = ?, height = ?, layouts = ?,
          global_settings = ?, next_slide = ?, sort_order = ?, updated_at = unixepoch()
          WHERE bundled_key = ?`,
        values,
      )
      return
    }
    db.run(
      `INSERT INTO slide_templates
        (name, width, height, layouts, global_settings, next_slide, sort_order, bundled_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      values,
    )
  })
}
