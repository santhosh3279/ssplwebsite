import { createServer } from 'node:http'
import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createEditor } from './editor.js'
import { initializeProduction, productionContent } from './content.js'

const repository = fileURLToPath(new URL('../', import.meta.url))
export async function createWebsite({ dataDir = process.env.DATA_DIR || resolve(repository, 'data'), origin = process.env.APP_ORIGIN, repositoryDir = repository } = {}) {
  const data = resolve(dataDir)
  await initializeProduction(data, repositoryDir)
  const editor = createEditor({ base: pathToFileURL(data + sep), origin, allowItems: true, loadContent: () => productionContent(data, repositoryDir) })
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.json': 'application/json' }
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    try {
      await editor(req, res, async () => {
        if (!['GET', 'HEAD'].includes(req.method)) { res.statusCode = 405; res.end(); return }
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
        if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.') || part.includes('\\'))) {
          res.statusCode = 404; res.end('Not found.'); return
        }
        const page = ['/', '/login', '/login/', '/gallery', '/gallery/'].includes(pathname)
        const liveAsset = pathname.startsWith('/production-media/')
        const folder = liveAsset ? resolve(data, 'public') : resolve(repositoryDir, 'dist')
        const relative = page ? 'index.html' : liveAsset ? pathname.slice('/production-media/'.length) : pathname.slice(1)
        const filename = resolve(folder, relative)
        if (!filename.startsWith(folder + sep)) { res.statusCode = 404; res.end('Not found.'); return }
        let info
        try { info = await stat(filename) } catch { res.statusCode = 404; res.end('Not found.'); return }
        if (!info.isFile()) { res.statusCode = 404; res.end('Not found.'); return }
        res.setHeader('Content-Type', mime[extname(filename)] || 'application/octet-stream')
        res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
        res.setHeader('Content-Length', info.size)
        if (req.method === 'HEAD') { res.end(); return }
        const stream = createReadStream(filename)
        stream.on('error', () => res.destroy())
        stream.pipe(res)
      })
    } catch { if (!res.headersSent) res.statusCode = 500; res.end('Could not load this page.') }
  })
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.APP_ORIGIN) throw new Error('Set APP_ORIGIN to the website origin, such as https://your-domain.example.')
  const server = await createWebsite()
  const port = Number(process.env.PORT || 3000)
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Website server listening on port ${port}`))
}
