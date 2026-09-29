import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { docBridgePlugin } from './bridge/docBridge.ts'

export default defineConfig({
  base: '/mini-figma/',
  plugins: [react(), tailwindcss(), docBridgePlugin()],
  server: {
    watch: {
      // doc.json — это «база данных» (пишется и MCP-сервером, и автосейвом App).
      // Без ignore Vite вызывает full page reload на каждый автосейв.
      ignored: ['**/mcp-server/doc.json', '**/mcp-server/doc.json.*.tmp'],
    },
  },
})