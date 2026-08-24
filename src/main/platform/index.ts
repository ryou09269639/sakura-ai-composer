import type { PlatformDriver } from './types'
import { win32Driver } from './win32'
import { darwinDriver } from './darwin'
import { linuxDriver } from './linux'

export type { ActiveWindowHandle, PlatformDriver } from './types'

export function getPlatformDriver(): PlatformDriver {
  switch (process.platform) {
    case 'win32':
      return win32Driver
    case 'darwin':
      return darwinDriver
    case 'linux':
      return linuxDriver
    default:
      throw new Error(`未対応のプラットフォームです: ${process.platform}`)
  }
}
