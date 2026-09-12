import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { createWebsite } from './index.js'
import { createEditor } from './editor.js'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}`
}
async function close(server) {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
test('production login protects all editors and persists public content across restarts', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'website-editor-test-'))
  let server
  try {
    server = await createWebsite({ dataDir })
    let origin = await listen(server)
    let cookie = ''
    const request = (path, body, extra = {}) => fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, Cookie: cookie, ...(Buffer.isBuffer(body) ? {} : { 'Content-Type': 'application/json' }), ...extra },
      body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
    })
    assert.equal((await request('/login')).status, 200)
    assert.equal((await request('/server/credentials.json')).status, 404)
    assert.equal((await request('/data/src/items.json')).status, 404)
    assert.equal((await request('/.git/config')).status, 404)
    assert.deepEqual(await (await request('/api/session')).json(), { authenticated: false })
    const before = await (await request('/api/content')).json()
    for (const route of ['logo', 'shops?index=0', 'gallery', 'items']) {
      assert.equal((await request('/api/admin/' + route, {})).status, 401)
    }
    assert.equal((await request('/__dev/items', {})).status, 401)
    assert.equal((await request('/api/login', { username: 'swarna', password: 'wrong' })).status, 401)
    assert.equal((await request('/api/login', { username: 'swarna', password: '3279' }, { Origin: 'https://other.example' })).status, 403)
    const login = await request('/api/login', { username: 'swarna', password: '3279' })
    assert.equal(login.status, 200)
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
    cookie = login.headers.get('set-cookie').split(';')[0]
    assert.deepEqual(await (await request('/api/session')).json(), { authenticated: true })
    assert.equal((await request('/api/admin/items', { topic: 'Test topic', name: 'Cup' }, { Origin: 'https://other.example' })).status, 403)
    assert.equal((await request('/api/admin/shops?index=99', png)).status, 400)
    assert.equal((await request('/api/admin/shops?index=0', Buffer.from('not an image'))).status, 400)
    for (let index = 0; index < 3; index++) {
      assert.equal((await request(`/api/admin/shops?index=${index}`, png)).status, 200)
      assert.deepEqual(Buffer.from(await (await request(`/production-media/photos/shop-${index}.png`)).arrayBuffer()), png)
    }
    assert.equal((await request('/api/admin/logo', png)).status, 200)
    assert.deepEqual(Buffer.from(await (await request('/production-media/logo.png')).arrayBuffer()), png)
    assert.equal((await request('/api/admin/items', { topic: 'Test topic', name: 'Cup, Plate' })).status, 200)
    let content = await (await request('/api/content')).json()
    assert.deepEqual(content.items.find(v => v.topic === 'Test topic').items, ['Cup', 'Plate'])
    assert.equal((await request('/api/admin/items', { action: 'delete-item', topic: 'Test topic', name: 'Cup' })).status, 200)
    assert.equal((await request('/api/admin/gallery', { heading: 'Test gallery', images: [png.toString('base64')] })).status, 200)
    content = await (await request('/api/content')).json()
    const photo = content.gallery.find(v => v.section === 'Test gallery')
    assert.ok(photo)
    assert.equal((await request(photo.src)).status, 200)
    assert.equal((await request('/api/admin/gallery', { action: 'rename', previous: 'Test gallery', heading: 'New heading' })).status, 200)
    content = await (await request('/api/content')).json()
    assert.equal(content.gallery.find(v => v.src === photo.src).section, 'New heading')
    assert.equal((await request('/api/admin/gallery', { action: 'delete', src: photo.editSrc })).status, 200)
    assert.equal((await request(photo.src)).status, 404)
    assert.equal((await request('/api/admin/items', { topic: 'Temporary topic', name: 'Temporary item' })).status, 200)
    assert.equal((await request('/api/admin/items', { action: 'delete-topic', topic: 'Temporary topic' })).status, 200)
    content = await (await request('/api/content')).json()
    assert.equal(content.items.some(v => v.topic === 'Temporary topic'), false)
    assert.equal((await request('/api/logout', {})).status, 200)
    assert.equal((await request('/api/admin/items', { topic: 'Blocked', name: 'No' })).status, 401)
    await close(server)
    server = await createWebsite({ dataDir })
    origin = await listen(server)
    content = await (await request('/api/content')).json()
    assert.deepEqual(content.items.find(v => v.topic === 'Test topic').items, ['Plate'])
    assert.equal(content.gallery.length, before.gallery.length)
    assert.deepEqual(Buffer.from(await (await request('/production-media/photos/shop-0.png')).arrayBuffer()), png)
    assert.deepEqual(await (await request('/api/session')).json(), { authenticated: false })
  } finally {
    if (server?.listening) await close(server)
    await rm(dataDir, { recursive: true, force: true })
  }
})
test('sessions expire, HTTPS cookies are secure, and repeated bad logins are throttled', async () => {
  let time = Date.now()
  const expectedOrigin = 'https://shop.example'
  const middleware = createEditor({ origin: expectedOrigin, now: () => time })
  const server = createServer(middleware)
  const origin = await listen(server)
  try {
    const login = password => fetch(origin + '/api/login', { method: 'POST', headers: { Origin: expectedOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'swarna', password }) })
    const response = await login('3279')
    assert.equal(response.status, 200)
    assert.match(response.headers.get('set-cookie'), /; Secure/)
    const cookie = response.headers.get('set-cookie').split(';')[0]
    time += 8 * 60 * 60 * 1000 + 1
    assert.deepEqual(await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json(), { authenticated: false })
    for (let i = 0; i < 10; i++) assert.equal((await login('bad')).status, 401)
    assert.equal((await login('3279')).status, 429)
    time += 15 * 60 * 1000 + 1
    assert.equal((await login('3279')).status, 200)
  } finally { await close(server) }
})
