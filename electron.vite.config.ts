import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@ai': resolve('src/ai')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        output: {
          // package.jsonの"type":"module"により既定ではESM(.mjs)で出力されるが、
          // Electronのサンドボックス化preloadローダーはimport文を実行できず、
          // contextBridge経由のAPI公開がサイレントに失敗してしまう(window.sakuraApiが常にundefined)。
          // CommonJSで明示的に出力することで、パッケージング後も確実に動作させる。
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer/composer',
    build: {
      outDir: 'out/renderer/composer',
      rollupOptions: {
        input: resolve('src/renderer/composer/index.html')
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
