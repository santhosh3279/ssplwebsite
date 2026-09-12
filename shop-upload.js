import { mkdir, readFile, writeFile } from 'node:fs/promises'

export default function shopUpload(base = new URL("./", import.meta.url)) {
  let pending = Promise.resolve()
  return {
    name: 'development-shop-upload',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/admin/shops', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        const index = new URL(req.url, 'http://localhost').searchParams.get('index')
        if (!/^[0-2]$/.test(index || '')) {
          res.statusCode = 400; res.end('Choose a valid shop.'); return
        }
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 5 * 1024 * 1024) { res.statusCode = 413; res.end('Choose a smaller photo.'); return }
            chunks.push(chunk)
          }
          const image = Buffer.concat(chunks)
          if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
            res.statusCode = 400; res.end('Please upload a valid PNG image.'); return
          }
          const save = pending.then(async () => {
            const metadata = new URL('./src/shops.json', base)
            const shops = JSON.parse(await readFile(metadata, 'utf8'))
            await mkdir(new URL('./public/photos/', base), { recursive: true })
            const photo = `/photos/shop-${index}.png`
            await writeFile(new URL(`./public${photo}`, base), image)
            shops[Number(index)].photo = photo
            await writeFile(metadata, JSON.stringify(shops, null, 2) + '\n')
          })
          pending = save.catch(() => {})
          await save
          res.end('Photo saved.')
        } catch {
          res.statusCode = 500; res.end('Could not save the photo. Please try again.')
        }
      })
    },
  }
}
