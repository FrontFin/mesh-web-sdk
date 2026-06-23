import { LinkStyle } from './types'

export function getLinkStyle(url: string): LinkStyle | undefined {
  try {
    const params = new URLSearchParams(new URL(url).search)
    const style = params.get('link_style')
    if (!style) return undefined

    if (typeof atob === 'undefined') return undefined
    return JSON.parse(atob(style))
  } catch (e) {
    return undefined
  }
}

export function getNumber(def: number, value?: number): number {
  return value !== undefined ? value : def
}
