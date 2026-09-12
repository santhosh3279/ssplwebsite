import { writeFile } from 'node:fs/promises'
export default function logoUpload(base) {
  return { configureServer(server) {
    server.middlewares.use('/api/admin/logo', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
      try {
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > 5 * 1024 * 1024) { res.statusCode = 413; res.end('Choose an image up to 5 MB.'); return }
          chunks.push(chunk)
        }
        const image = Buffer.concat(chunks)
        if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
          res.statusCode = 400; res.end('Please upload a valid PNG image.'); return
        }
        await writeFile(new URL('./public/logo.png', base), image)
        await writeFile(new URL('./src/logo.json', base), JSON.stringify({ url: '/logo.png' }))
        res.end('Logo saved.')
      } catch { res.statusCode = 500; res.end('Could not save the logo. Please try again.') }
    })
  } }
}
