import itemsEditor from './items-editor.js'
import galleryUpload from './gallery-upload.js'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), galleryUpload(), itemsEditor(), {
    name: 'static-gallery-page',
    apply: 'build',
    async closeBundle() {
      const html = await readFile(new URL('./dist/index.html', import.meta.url), 'utf8')
      await mkdir(new URL('./dist/gallery/', import.meta.url), { recursive: true })
      await writeFile(new URL('./dist/gallery/index.html', import.meta.url), html.replace('<title>Chettiyar Kada | Our Shops in Palakkad</title>', '<title>Gallery | Chettiyar Kada</title>'))
    },
  }, {
    name: 'development-logo-upload',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/logo', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        if (req.headers.origin !== `http://${req.headers.host}`) {
          res.statusCode = 403; res.end('Upload must come from this development site.'); return
        }
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 5 * 1024 * 1024) { res.statusCode = 413; res.end('Choose an image smaller than 5 MB.'); return }
            chunks.push(chunk)
          }
          const image = Buffer.concat(chunks)
          if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
            res.statusCode = 400; res.end('Please upload a valid image.'); return
          }
          await writeFile(new URL('./public/logo.png', import.meta.url), image)
          await writeFile(new URL('./src/logo.json', import.meta.url), JSON.stringify({ url: '/logo.png' }))
          res.end('Logo saved.')
        } catch {
          res.statusCode = 500; res.end('Could not save the logo. Please try again.')
        }
      })
    },
  }],
  server: {
    host: '0.0.0.0',
  },
})
