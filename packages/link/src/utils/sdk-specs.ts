import { sdkVersion } from './version'

const origin = typeof window !== 'undefined' ? window.location.origin : undefined

export const sdkSpecs = {
  platform: 'web',
  version: sdkVersion,
  origin
}
