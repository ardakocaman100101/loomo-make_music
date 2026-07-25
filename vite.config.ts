import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [devtoolsJson(), tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    allowedHosts: [
      'proddingly-ericeticolous-diego.ngrok-free.dev', // Allows this specific host
      '.ngrok-free.dev', // Optional: Allows ANY future ngrok host you generate
    ],
  },
})
