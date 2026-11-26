import type { PptxRgba } from './types'
import { xmlChildren } from '../xml/xmlChildren'
import { xmlNumber } from '../xml/xmlNumber'

const toLinear = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const fromLinear = (v: number) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, c)) * 255)
}

function toHsl({ r, g, b }: PptxRgba) {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === R
      ? (G - B) / d + (G < B ? 6 : 0)
      : max === G
        ? (B - R) / d + 2
        : (R - G) / d + 4
  return { h: h / 6, s, l }
}

function fromHsl(h: number, s: number, l: number, a: number): PptxRgba {
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  ;[s, l] = [clamp(s), clamp(l)]
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v, a }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    const v =
      u < 1 / 6
        ? p + (q - p) * 6 * u
        : u < 1 / 2
          ? q
          : u < 2 / 3
            ? p + (q - p) * (2 / 3 - u) * 6
            : p
    return Math.round(v * 255)
  }
  return { r: channel(h + 1 / 3), g: channel(h), b: channel(h - 1 / 3), a }
}

/**
 * A colour changed by the modifiers under its element, in order, as Office
 * does: `lumMod`/`lumOff`/`satMod` on its HSL lightness and saturation,
 * `tint` (towards white) and `shade` (towards black) in linear RGB, and
 * `alpha`/`alphaMod`/`alphaOff`.
 */
export function applyColorMods(color: PptxRgba, element: Element): PptxRgba {
  let result = color
  for (const mod of xmlChildren(element)) {
    const value = (xmlNumber(mod, 'val') ?? 100_000) / 100_000
    switch (mod.localName) {
      case 'lumMod':
      case 'lumOff':
      case 'satMod': {
        const { h, s, l } = toHsl(result)
        result =
          mod.localName === 'lumMod'
            ? fromHsl(h, s, l * value, result.a)
            : mod.localName === 'lumOff'
              ? fromHsl(h, s, l + value, result.a)
              : fromHsl(h, s * value, l, result.a)
        break
      }
      case 'tint':
      case 'shade': {
        const change = (c: number) => {
          const v = toLinear(c)
          return fromLinear(
            mod.localName === 'tint' ? v * value + (1 - value) : v * value,
          )
        }
        result = {
          r: change(result.r),
          g: change(result.g),
          b: change(result.b),
          a: result.a,
        }
        break
      }
      case 'alpha':
        result = { ...result, a: value }
        break
      case 'alphaMod':
        result = { ...result, a: Math.min(1, result.a * value) }
        break
      case 'alphaOff':
        result = { ...result, a: Math.min(1, Math.max(0, result.a + value)) }
        break
    }
  }
  return result
}
