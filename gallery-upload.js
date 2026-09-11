import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export default function galleryUpload() {
  let pending = Promise.resolve()
  return {
    name: 'development-gallery-upload',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/gallery', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        if (req.headers.origin !== `http://${req.headers.host}`) {
          res.statusCode = 403; res.end('Upload must come from this development site.'); return
        }
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 8 * 1024 * 1024) { res.statusCode = 413; res.end('Photo is too large.'); return }
            chunks.push(chunk)
          }
          let data
          try { data = JSON.parse(Buffer.concat(chunks).toString()) } catch {
            res.statusCode = 400; res.end('Invalid photo upload.'); return
          }
          const heading = typeof data.heading === 'string' ? data.heading.trim() : ''
          const image = typeof data.image === 'string' ? Buffer.from(data.image, 'base64') : Buffer.alloc(0)
          if (!heading || heading.length > 120 || image.length > 5 * 1024 * 1024 || !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
            res.statusCode = 400; res.end('Choose a valid photo and a heading of up to 120 characters.'); return
          }
          const save = pending.then(async () => {
            const metadata = new URL('./src/gallery.json', import.meta.url)
            const photos = JSON.parse(await readFile(metadata, 'utf8'))
            const filename = `${randomUUID()}.png`
            await mkdir(new URL('./public/gallery/', import.meta.url), { recursive: true })
            await writeFile(new URL(`./public/gallery/${filename}`, import.meta.url), image)
            photos.push({ src: `/gallery/${filename}`, alt: heading, caption: heading })
            await writeFile(metadata, JSON.stringify(photos, null, 2) + '\n')
          })
          pending = save.catch(() => {})
          await save
          res.end('Photo added.')
        } catch {
          res.statusCode = 500; res.end('Could not save the photo. Please try again.')
        }
      })
    },
  }
}
