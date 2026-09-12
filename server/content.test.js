import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { initializeProduction, productionContent, developmentContent } from './content.js'
import { createWebsite } from './index.js'
import { createEditor } from './editor.js'
const json = (root, name, data) => writeFile(join(root, `src/${name}.json`), JSON.stringify(data))
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'photo-sources-test-'))
  const repository = join(root, 'repository')
  const data = join(root, 'production')
  for (const path of ['src', 'public/photos', 'public/gallery', 'dist/photos', 'dist/gallery']) await mkdir(join(repository, path), { recursive: true })
  await json(repository, 'shops', [0, 1, 2].map(index => ({ name: `Shop ${index}`, photo: index === 0 ? '/photos/shop-0.png' : '' })))
  await json(repository, 'gallery', [{ src: '/gallery/development.png', alt: 'Development', section: 'Collection' }])
  await json(repository, 'items', [{ topic: 'Development only', items: ['Must never be shown'] }])
  await json(repository, 'logo', { url: '/logo.png' })
  for (const file of ['photos/shop-0.png', 'gallery/development.png', 'logo.png']) {
    await writeFile(join(repository, 'public', file), 'development image')
    await writeFile(join(repository, 'dist', file), 'development image')
  }
  await writeFile(join(repository, 'dist/index.html'), '<html>Website</html>')
  return { root, repository, data }
}
async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}`
}
async function close(server) {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
test('separate photo sets merge and repository updates cannot seed or replace production items', async () => {
  const f = await fixture()
  let server
  try {
    await initializeProduction(f.data, f.repository)
    let content = await productionContent(f.data, f.repository)
    assert.deepEqual(content.items, [])
    assert.equal(content.gallery.length, 1)
    assert.equal(content.gallery[0].editable, false)
    await json(f.data, 'items', [{ topic: 'Production only', items: ['Live item'] }])
    await json(f.data, 'shops', [0, 1, 2].map(index => ({ name: `Shop ${index}`, photo: index === 0 ? '/photos/shop-0.png' : '' })))
    await json(f.data, 'gallery', [{ src: '/gallery/live.png', alt: 'Live', section: 'Collection' }])
    await mkdir(join(f.data, 'public/photos'), { recursive: true })
    await mkdir(join(f.data, 'public/gallery'), { recursive: true })
    await writeFile(join(f.data, 'public/photos/shop-0.png'), 'production image')
    await writeFile(join(f.data, 'public/gallery/live.png'), 'production gallery image')
    server = await createWebsite({ dataDir: f.data, repositoryDir: f.repository })
    const origin = await listen(server)
    content = await (await fetch(origin + '/api/content')).json()
    assert.deepEqual(content.shops[0].photos.map(photo => photo.src), ['/photos/shop-0.png', '/production-media/photos/shop-0.png'])
    assert.deepEqual(content.gallery.map(photo => photo.source), ['development', 'production'])
    assert.equal(content.gallery[1].editable, true)
    assert.equal(await (await fetch(origin + '/photos/shop-0.png')).text(), 'development image')
    assert.equal(await (await fetch(origin + '/production-media/photos/shop-0.png')).text(), 'production image')
    await json(f.repository, 'gallery', [{ src: '/gallery/new-development.png', alt: 'New development', section: 'New section' }])
    await json(f.repository, 'items', [{ topic: 'Replacement development', items: ['Still must never appear'] }])
    await initializeProduction(f.data, f.repository)
    content = await productionContent(f.data, f.repository)
    assert.equal(content.gallery[0].src, '/gallery/new-development.png')
    assert.equal(content.gallery[1].src, '/production-media/gallery/live.png')
    assert.deepEqual(content.items, [{ topic: 'Production only', items: ['Live item'] }])
    const preview = await developmentContent(f.repository, origin)
    assert.equal(preview.itemsAvailable, true)
    assert.equal(preview.editItems, false)
    assert.deepEqual(preview.items, content.items)
    assert.equal(preview.gallery[0].editable, true)
    assert.equal(preview.gallery[1].editable, false)
    assert.equal(preview.shops[0].photos[1].src, origin + '/production-media/photos/shop-0.png')
    const unavailable = await developmentContent(f.repository)
    assert.equal(unavailable.itemsAvailable, false)
    assert.deepEqual(unavailable.items, [])
    assert.equal(unavailable.gallery.length, 1)
  } finally {
    if (server?.listening) await close(server)
    await rm(f.root, { recursive: true, force: true })
  }
})
test('legacy migration backs up metadata, removes unchanged copied photos, and preserves live edits and items', async () => {
  const f = await fixture()
  try {
    await mkdir(f.data)
    await cp(join(f.repository, 'src'), join(f.data, 'src'), { recursive: true })
    await cp(join(f.repository, 'public'), join(f.data, 'public'), { recursive: true })
    await writeFile(join(f.data, '.initialized'), 'Old seeded content')
    await writeFile(join(f.data, 'public/photos/shop-0.png'), 'different production upload')
    const items = [{ topic: 'Existing production', items: ['Preserve me'] }]
    await json(f.data, 'items', items)
    await initializeProduction(f.data, f.repository)
    const content = await productionContent(f.data, f.repository)
    assert.equal(content.shops[0].photos.length, 2)
    assert.equal(content.gallery.length, 1)
    assert.deepEqual(content.items, items)
    assert.equal(JSON.parse(await readFile(join(f.data, 'src/logo.json'))).url, '')
    assert.equal(JSON.parse(await readFile(join(f.data, 'migration-backup/gallery.json'))).length, 1)
    assert.equal(await readFile(join(f.data, 'public/gallery/development.png'), 'utf8'), 'development image')
    await json(f.repository, 'gallery', [])
    await initializeProduction(f.data, f.repository)
    assert.equal((await productionContent(f.data, f.repository)).gallery.length, 0)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})
test('development rejects item writes even with a valid authenticated session', async () => {
  const f = await fixture()
  const server = createServer(createEditor({ base: pathToFileURL(f.repository + '/') }))
  const origin = await listen(server)
  try {
    const login = await fetch(origin + '/api/login', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ username: 'swarna', password: '3279' }) })
    assert.equal(login.status, 200)
    const response = await fetch(origin + '/api/admin/items', { method: 'POST', headers: { Origin: origin, Cookie: login.headers.get('set-cookie').split(';')[0] }, body: JSON.stringify({ topic: 'Bad local write', name: 'No' }) })
    assert.equal(response.status, 403)
    const content = await (await fetch(origin + '/api/content')).json()
    assert.deepEqual(content.items, [])
    assert.deepEqual(JSON.parse(await readFile(join(f.repository, 'src/items.json'))), [{ topic: 'Development only', items: ['Must never be shown'] }])
  } finally { await close(server); await rm(f.root, { recursive: true, force: true }) }
})
