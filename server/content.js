import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { constants } from 'node:fs'

const names = ['shops', 'gallery', 'items', 'logo']
const readJSON = async (root, name) => JSON.parse(await readFile(resolve(root, `src/${name}.json`), 'utf8'))
const saveJSON = (root, name, value) => writeFile(resolve(root, `src/${name}.json`), JSON.stringify(value, null, 2) + '\n')
const exists = async path => { try { await access(path); return true } catch { return false } }
async function sameImage(data, repository, productionPath, developmentPath) {
  if (!productionPath || !developmentPath || productionPath !== developmentPath) return false
  const safePath = (root, path) => {
    const publicRoot = resolve(root, 'public')
    const file = resolve(publicRoot, path.replace(/^\//, ''))
    if (!file.startsWith(publicRoot + sep)) throw new Error('Invalid photo path.')
    return file
  }
  try {
    const [production, development] = await Promise.all([readFile(safePath(data, productionPath)), readFile(safePath(repository, developmentPath))])
    return production.equals(development)
  } catch { return false }
}

export async function initializeProduction(data, repository) {
  await mkdir(resolve(data, 'src'), { recursive: true })
  await mkdir(resolve(data, 'public'), { recursive: true })
  const developmentShops = await readJSON(repository, 'shops')
  const defaults = { shops: developmentShops.map(shop => ({ name: shop.name, photo: '' })), gallery: [], items: [], logo: { url: '' } }
  for (const name of names) {
    try { await writeFile(resolve(data, `src/${name}.json`), JSON.stringify(defaults[name], null, 2) + '\n', { flag: 'wx' }) }
    catch (error) { if (error.code !== 'EEXIST') throw error }
  }
  if (!await exists(resolve(data, '.photo-sources-v2'))) {
    // Older servers copied development photos into production storage. Preserve a
    // metadata backup and remove only entries that still exactly match that copy.
    if (await exists(resolve(data, '.initialized'))) {
      await mkdir(resolve(data, 'migration-backup'), { recursive: true })
      for (const name of names) {
        try { await copyFile(resolve(data, `src/${name}.json`), resolve(data, `migration-backup/${name}.json`), constants.COPYFILE_EXCL) }
        catch (error) { if (error.code !== 'EEXIST') throw error }
      }
      const storedShops = await readJSON(data, 'shops')
      for (const [index, shop] of storedShops.entries()) {
        if (await sameImage(data, repository, shop.photo, developmentShops[index]?.photo)) shop.photo = ''
      }
      await saveJSON(data, 'shops', storedShops)
      const developmentGallery = await readJSON(repository, 'gallery')
      const storedGallery = await readJSON(data, 'gallery')
      const retained = []
      for (const photo of storedGallery) {
        const original = developmentGallery.find(candidate => candidate.src === photo.src)
        const identicalMetadata = original && ['alt', 'section', 'caption'].every(key => original[key] === photo[key])
        if (!identicalMetadata || !await sameImage(data, repository, photo.src, original.src)) retained.push(photo)
      }
      await saveJSON(data, 'gallery', retained)
      const storedLogo = await readJSON(data, 'logo')
      const developmentLogo = await readJSON(repository, 'logo')
      if (await sameImage(data, repository, storedLogo.url, developmentLogo.url)) await saveJSON(data, 'logo', { url: '' })
    }
    await writeFile(resolve(data, '.photo-sources-v2'), 'Development and production photos are independent.\n')
  }
}
const mediaURL = (path, source) => source === 'production' && path.startsWith('/') ? `/production-media${path}` : path
function ownPhotos(content, source, editable) {
  return {
    shops: content.shops.map(shop => ({ ...shop, photos: shop.photo ? [{ src: mediaURL(shop.photo, source), source }] : [] })),
    gallery: content.gallery.map(photo => ({ ...photo, src: mediaURL(photo.src, source), editSrc: photo.src, source, editable })),
    logo: { url: content.logo.url ? mediaURL(content.logo.url, source) : '' },
  }
}
async function readPhotos(root) {
  const [shops, gallery, logo] = await Promise.all(['shops', 'gallery', 'logo'].map(name => readJSON(root, name)))
  return { shops, gallery, logo }
}
function mergePhotos(development, production) {
  return {
    shops: development.shops.map((shop, index) => ({ ...shop, photos: [...shop.photos, ...(production.shops[index]?.photos || [])] })),
    gallery: [...development.gallery, ...production.gallery],
    logo: production.logo.url ? production.logo : development.logo,
  }
}
export async function productionContent(data, repository) {
  const development = ownPhotos(await readPhotos(repository), 'development', false)
  const production = ownPhotos(await readPhotos(data), 'production', true)
  return { ...mergePhotos(development, production), items: await readJSON(data, 'items'), itemsAvailable: true, editItems: true }
}
export async function developmentContent(repository, productionOrigin) {
  const development = ownPhotos(await readPhotos(repository), 'development', true)
  let production = { shops: [], gallery: [], logo: { url: '' } }
  let items = []
  let itemsAvailable = false
  if (productionOrigin) {
    try {
      const origin = new URL(productionOrigin)
      if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('Invalid production origin.')
      const response = await fetch(new URL('/api/content', origin), { signal: AbortSignal.timeout(5000), headers: { 'X-Content-Preview': '1' } })
      if (!response.ok) throw new Error('Production content unavailable.')
      const content = await response.json()
      const absolute = src => new URL(src, origin).href
      production = {
        shops: content.shops.map(shop => ({ ...shop, photos: (shop.photos || []).filter(photo => photo.source === 'production').map(photo => ({ ...photo, src: absolute(photo.src) })) })),
        gallery: content.gallery.filter(photo => photo.source === 'production').map(photo => ({ ...photo, src: absolute(photo.src), editable: false })),
        logo: { url: content.logo.url.startsWith('/production-media/') ? absolute(content.logo.url) : '' },
      }
      items = content.items
      itemsAvailable = content.itemsAvailable === true
    } catch { /* Show local photos and no substitute items if production is offline. */ }
  }
  return { ...mergePhotos(development, production), items, itemsAvailable, editItems: false }
}
