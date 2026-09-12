import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export default function galleryUpload(base = new URL("./", import.meta.url)) {
  let pending = Promise.resolve()
  return {
    name: 'development-gallery-upload',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/admin/gallery', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 145 * 1024 * 1024) { res.statusCode = 413; res.end('Photo is too large.'); return }
            chunks.push(chunk)
          }
          let data
          try { data = JSON.parse(Buffer.concat(chunks).toString()) } catch {
            res.statusCode = 400; res.end('Invalid photo upload.'); return
          }
          if (data?.action === 'delete') {
            if (typeof data.src !== 'string' || !/^\/gallery\/[a-f0-9-]+\.png$/.test(data.src)) {
              res.statusCode = 400; res.end('Invalid photo.'); return
            }
            const remove = pending.then(async () => {
              const metadata = new URL('./src/gallery.json', base)
              const photos = JSON.parse(await readFile(metadata, 'utf8'))
              if (!photos.some(photo => photo.src === data.src)) return false
              await writeFile(metadata, JSON.stringify(photos.filter(photo => photo.src !== data.src), null, 2) + '\n')
              await unlink(new URL(`./public${data.src}`, base)).catch(error => {
                if (error.code !== 'ENOENT') throw error
              })
              return true
            })
            pending = remove.catch(() => {})
            if (!await remove) { res.statusCode = 404; res.end('Photo no longer exists.'); return }
            res.end('Photo deleted.'); return
          }
          const heading = typeof data.heading === 'string' ? data.heading.trim() : ''
          if (data.action === 'rename') {
            const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase()
            const previous = typeof data.previous === 'string' ? data.previous : ''
            if (!heading || heading.length > 120 || !previous.trim()) {
              res.statusCode = 400; res.end('Enter a section name of up to 120 characters.'); return
            }
            const rename = pending.then(async () => {
              const metadata = new URL('./src/gallery.json', base)
              const photos = JSON.parse(await readFile(metadata, 'utf8'))
              const sectionOf = photo => photo.section || photo.caption || 'Our collection'
              const matches = photos.filter(photo => normalize(sectionOf(photo)) === normalize(previous))
              if (!matches.length) return 'Section no longer exists. Refresh and try again.'
              if (normalize(previous) !== normalize(heading) && photos.some(photo => normalize(sectionOf(photo)) === normalize(heading))) {
                return 'That section name already exists. Choose a different name.'
              }
              for (const photo of matches) {
                if (photo.alt === sectionOf(photo)) photo.alt = heading
                photo.section = heading.replace(/\s+/g, ' ')
              }
              await writeFile(metadata, JSON.stringify(photos, null, 2) + '\n')
            })
            pending = rename.catch(() => {})
            const error = await rename
            if (error) { res.statusCode = 409; res.end(error); return }
            res.end('Section renamed.'); return
          }
          const images = Array.isArray(data.images) ? data.images : []
          if (!heading || heading.length > 120 || !images.length || images.length > 20) {
            res.statusCode = 400; res.end('Enter a section name and choose 1 to 20 photos.'); return
          }
          const buffers = images.map(image => typeof image === 'string' ? Buffer.from(image, 'base64') : Buffer.alloc(0))
          if (buffers.some(image => image.length > 5 * 1024 * 1024 || !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))) {
            res.statusCode = 400; res.end('Each photo must be a valid PNG smaller than 5 MB.'); return
          }
          const save = pending.then(async () => {
            const metadata = new URL('./src/gallery.json', base)
            const photos = JSON.parse(await readFile(metadata, 'utf8'))
            await mkdir(new URL('./public/gallery/', base), { recursive: true })
            for (const image of buffers) {
              const filename = `${randomUUID()}.png`
              await writeFile(new URL(`./public/gallery/${filename}`, base), image)
              photos.push({ src: `/gallery/${filename}`, alt: heading, section: heading })
            }
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
