import editorPlugin from './server/editor.js'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

export default defineConfig({
  plugins: [vue(), editorPlugin(), {
    name: 'static-pages',
    apply: 'build',
    async closeBundle() {
      const html = await readFile(new URL('./dist/index.html', import.meta.url), 'utf8')
      for (const [page, title] of [['gallery', 'Gallery'], ['login', 'Sign in']]) {
        await mkdir(new URL(`./dist/${page}/`, import.meta.url), { recursive: true })
        await writeFile(new URL(`./dist/${page}/index.html`, import.meta.url), html.replace('<title>Chettiyar Kada | Our Shops in Palakkad</title>', `<title>${title} | Chettiyar Kada</title>`))
      }
    },
  }],
  server: {
    host: '0.0.0.0',
    fs: { deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/server/**', '**/data/**'] },
  },
})
