import { readFile } from 'node:fs/promises'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import shops from '../shop-upload.js'
import gallery from '../gallery-upload.js'
import items from '../items-editor.js'
import logo from './logo-upload.js'

const derive = promisify(scrypt)
const credentials = JSON.parse(await readFile(new URL('./credentials.json', import.meta.url), 'utf8'))
const lifetime = 8 * 60 * 60 * 1000
const send = (res, code, message) => { res.statusCode = code; res.end(message) }
export function createEditor({ base = new URL('../', import.meta.url), origin = process.env.APP_ORIGIN, now = Date.now } = {}) {
  const sessions = new Map()
  const attempts = new Map()
  const routes = new Map()
  const adapter = { middlewares: { use(path, handler) { routes.set(path, handler) } } }
  for (const plugin of [shops(base), gallery(base), items(base), logo(base)]) plugin.configureServer(adapter)
  const cookie = (token, secure, maxAge = lifetime / 1000) => `ck_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
  return async function editor(req, res, next = () => send(res, 404, 'Not found.')) {
    const path = new URL(req.url, 'http://localhost').pathname
    if (!path.startsWith('/api/') && !path.startsWith('/__dev/')) return next()
    res.setHeader('Cache-Control', 'no-store')
    const time = now()
    for (const [key, expires] of sessions) if (expires <= time) sessions.delete(key)
    for (const [key, entry] of attempts) if (entry.until <= time) attempts.delete(key)
    const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('ck_session='))?.slice(11)
    const authenticated = !!token && sessions.has(token)
    const expectedOrigin = origin || `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`
    const secure = expectedOrigin.startsWith('https:')
    try {
      if (path === '/api/content' && req.method === 'GET') {
        const content = {}
        for (const name of ['shops', 'gallery', 'items', 'logo']) content[name] = JSON.parse(await readFile(new URL(`./src/${name}.json`, base), 'utf8'))
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(content)); return
      }
      if (path === '/api/session' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ authenticated })); return
      }
      if (req.method !== 'POST') return send(res, 405, 'Method not allowed.')
      if (req.headers.origin !== expectedOrigin) return send(res, 403, 'Please submit from this website.')
      if (path === '/api/login') {
        const address = req.socket.remoteAddress || 'unknown'
        const entry = attempts.get(address) || { count: 0, until: time + 15 * 60 * 1000 }
        if (entry.count >= 10 || sessions.size >= 1000 || attempts.size >= 10000) {
          res.setHeader('Retry-After', '900'); return send(res, 429, 'Too many sign-in attempts. Try again in 15 minutes.')
        }
        entry.count++; attempts.set(address, entry)
        let size = 0
        const chunks = []
        for await (const chunk of req) {
          size += chunk.length
          if (size > 4096) return send(res, 413, 'Login details are too long.')
          chunks.push(chunk)
        }
        let input
        try { input = JSON.parse(Buffer.concat(chunks).toString()) } catch { return send(res, 400, 'Invalid login details.') }
        if (typeof input?.username !== 'string' || typeof input?.password !== 'string') return send(res, 400, 'Enter your username and password.')
        const hash = await derive(input.password, credentials.salt, 64)
        if (!timingSafeEqual(hash, Buffer.from(credentials.passwordHash, 'hex')) || input.username !== credentials.username) return send(res, 401, 'Incorrect username or password.')
        if (token) sessions.delete(token)
        const newToken = randomBytes(32).toString('hex')
        sessions.set(newToken, time + lifetime)
        attempts.delete(address)
        res.setHeader('Set-Cookie', cookie(newToken, secure))
        return send(res, 200, 'Signed in.')
      }
      if (path === '/api/logout') {
        sessions.delete(token)
        res.setHeader('Set-Cookie', cookie('', secure, 0))
        return send(res, 200, 'Signed out.')
      }
      if (!authenticated) return send(res, 401, 'Your session has ended. Sign in again at /login.')
      const handler = routes.get(path)
      if (!handler) return send(res, 404, 'Not found.')
      await handler(req, res)
    } catch {
      if (!res.headersSent) send(res, 500, 'Could not complete the request. Please try again.')
      else res.end()
    }
  }
}
export default function editorPlugin() {
  return { name: 'authenticated-editor', apply: 'serve', configureServer(server) { server.middlewares.use(createEditor()) } }
}
