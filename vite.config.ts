import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import tsconfigPaths from 'vite-tsconfig-paths'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function excludeWasmPlugin(): Plugin {
  return {
    name: 'exclude-wasm-assets',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName.endsWith('.wasm')) {
          delete bundle[fileName]
        }
      }
    },
    closeBundle() {
      const assetsDir = path.resolve(__dirname, 'build/client/assets')
      if (fs.existsSync(assetsDir)) {
        for (const file of fs.readdirSync(assetsDir)) {
          if (file.endsWith('.wasm')) {
            fs.unlinkSync(path.join(assetsDir, file))
          }
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [devtoolsJson(), tailwindcss(), reactRouter(), tsconfigPaths(), excludeWasmPlugin()],
  server: {
    allowedHosts: [
      'proddingly-ericeticolous-diego.ngrok-free.dev', // Allows this specific host
      '.ngrok-free.dev', // Optional: Allows ANY future ngrok host you generate
    ],
  },
})
