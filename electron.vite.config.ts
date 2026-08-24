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
