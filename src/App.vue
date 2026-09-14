<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { shops as initialShops, catalogue, gallery as initialGallery } from './content'
import logo from './logo.json'
const shops = ref(initialShops.map(shop => ({ ...shop, photos: shop.photo ? [{ src: shop.photo, source: 'development' }] : [] })))
const gallery = ref(initialGallery.map(photo => ({ ...photo, source: 'development', editable: import.meta.env.DEV })))
const itemTopics = ref([])
const itemsAvailable = ref(false)
const itemsLoading = ref(true)
const itemsEditable = ref(false)
const canEditItems = computed(() => canEdit.value && itemsEditable.value)
const canEdit = ref(false)
const isLogin = /^\/login\/?$/.test(window.location.pathname)
const username = ref('')
const password = ref('')
const signingIn = ref(false)
const checkingSession = ref(true)
const loginMessage = ref('')
const editorMessage = ref('')
async function refreshContent() {
  const response = await fetch('/api/content', { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not refresh the website content.')
  const content = await response.json()
  shops.value = content.shops
  gallery.value = content.gallery
  itemTopics.value = content.itemsAvailable ? content.items : []
  itemsAvailable.value = content.itemsAvailable === true
  itemsEditable.value = content.editItems === true
  itemsLoading.value = false
  logoUrl.value = content.logo.url
}
async function editorFetch(url, options) {
  const response = await fetch(url, options)
  if (response.status === 401) {
    canEdit.value = false
    editorMessage.value = 'Your session has ended. Sign in again to continue editing.'
  }
  if (response.ok) {
    try { await refreshContent() } catch {
      editorMessage.value = 'Your change was saved. Refresh the page to load the latest content.'
    }
  }
  return response
}
async function signIn() {
  signingIn.value = true
  loginMessage.value = ''
  try {
    const response = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    })
    const message = await response.text()
    if ([404, 405, 502, 503, 504].includes(response.status) || /^\s*</.test(message)) {
      throw new Error('Sign-in is temporarily unavailable. Please try again later.')
    }
    if (!response.ok) throw new Error(message || 'Could not sign in. Please try again.')
    password.value = ''
    window.location.assign('/#shops')
  } catch (error) { loginMessage.value = error.message || 'Could not sign in. Please try again.' }
  finally { signingIn.value = false }
}
async function signOut() {
  try {
    const response = await fetch('/api/logout', { method: 'POST' })
    if (!response.ok) throw new Error('Could not sign out. Please try again.')
    canEdit.value = false
    window.location.assign('/login')
  } catch (error) { editorMessage.value = error.message }
}
onMounted(async () => {
  try {
    const response = await fetch('/api/session', { cache: 'no-store' })
    if (response.ok) canEdit.value = (await response.json()).authenticated === true
    else if (isLogin) loginMessage.value = 'Sign-in is not available on this server yet.'
  } catch { if (isLogin) loginMessage.value = 'Could not connect. Please try again.' }
  finally { checkingSession.value = false }
  try { await refreshContent() } catch { itemsLoading.value = false; itemsAvailable.value = false }
})
const logoUrl = ref(logo.url)
const logoInput = ref(null)
const uploading = ref(false)
const uploadMessage = ref('')
async function uploadLogo(event) {
  const file = event.target.files?.[0]
  if (!file) return
  uploading.value = true
  uploadMessage.value = ''
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Choose a PNG, JPG or WebP image smaller than 5 MB.')
    }
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not read this image. Please try another photo.')
    const response = await editorFetch('/api/admin/logo', { method: 'POST', body: blob })
    if (!response.ok) throw new Error(await response.text())
    logoUrl.value = `${logoUrl.value.split('?')[0]}?v=${Date.now()}`
    uploadMessage.value = 'Logo saved.'
  } catch (error) {
    uploadMessage.value = error.message || 'Could not upload the logo. Please try again.'
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}
const shopUploads = ref({})
const shopMessages = ref({})
async function uploadShopPhoto(event, index) {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return
  shopUploads.value[index] = true
  shopMessages.value[index] = ''
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Choose a PNG, JPG or WebP image up to 5 MB.')
    }
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not read this photo. Please try another image.')
    const response = await editorFetch(`/api/admin/shops?index=${index}`, { method: 'POST', body: blob })
    if (!response.ok) throw new Error(await response.text())
    for (const photo of shops.value[index].photos) photo.src = `${photo.src.split('?')[0]}?v=${Date.now()}`
    shopMessages.value[index] = 'Photo saved.'
  } catch (error) {
    shopMessages.value[index] = error.message || 'Could not upload the photo. Please try again.'
  } finally {
    shopUploads.value[index] = false
    input.value = ''
  }
}
const gallerySections = computed(() => {
  const sections = new Map()
  for (const photo of gallery.value) {
    const name = (photo.section || photo.caption || 'Our collection').trim().replace(/\s+/g, ' ')
    const key = name.toLowerCase()
    if (!sections.has(key)) sections.set(key, { name, photos: [] })
    sections.get(key).photos.push(photo)
  }
  return [...sections.values()]
})
const enlargedPhoto = ref(null)
const photoDialog = ref(null)
const viewerPhotos = computed(() => gallerySections.value.flatMap(section => section.photos))
const viewerIndex = computed(() => viewerPhotos.value.findIndex(photo => photo.src === enlargedPhoto.value?.src))
function movePhoto(step) {
  const photos = viewerPhotos.value
  if (!enlargedPhoto.value || photos.length < 2) return
  enlargedPhoto.value = photos[(viewerIndex.value + step + photos.length) % photos.length]
}
let photoTrigger = null
let previousOverflow = ''
async function enlargePhoto(photo, event) {
  photoTrigger = event.currentTarget
  enlargedPhoto.value = photo
  await nextTick()
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  photoDialog.value.showModal()
}
function closePhoto() {
  photoDialog.value?.close()
  document.body.style.overflow = previousOverflow
  enlargedPhoto.value = null
  photoTrigger?.focus()
}
onUnmounted(() => {
  if (enlargedPhoto.value) document.body.style.overflow = previousOverflow
})
const deletingPhoto = ref('')
const deleteMessage = ref('')
async function deletePhoto(photo) {
  if (!window.confirm('Delete this photo from the gallery?')) return
  deletingPhoto.value = photo.src
  deleteMessage.value = ''
  try {
    const response = await editorFetch('/api/admin/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', src: photo.editSrc || photo.src }),
    })
    if (!response.ok) throw new Error(await response.text())
    deleteMessage.value = 'Photo deleted.'
  } catch (error) {
    deleteMessage.value = error.message || 'Could not delete the photo. Please try again.'
  } finally {
    deletingPhoto.value = ''
  }
}
const renamingSection = ref('')
const sectionName = ref('')
const savingSection = ref(false)
const renameMessage = ref('')
function startRename(name) {
  renamingSection.value = name
  sectionName.value = name
  renameMessage.value = ''
}
async function renameSection() {
  if (!sectionName.value.trim()) { renameMessage.value = 'Enter a section name.'; return }
  savingSection.value = true
  renameMessage.value = ''
  try {
    const response = await editorFetch('/api/admin/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', previous: renamingSection.value, heading: sectionName.value.trim() }),
    })
    if (!response.ok) throw new Error(await response.text())
    renamingSection.value = ''
    renameMessage.value = 'Section renamed.'
  } catch (error) {
    renameMessage.value = error.message || 'Could not rename the section.'
  } finally {
    savingSection.value = false
  }
}
const photoHeading = ref('')
const photoInput = ref(null)
const savingPhoto = ref(false)
const photoMessage = ref('')
async function addGalleryPhoto() {
  const files = Array.from(photoInput.value.files || [])
  const heading = photoHeading.value.trim()
  if (!files.length || !heading) { photoMessage.value = 'Choose photos and enter a section name.'; return }
  if (files.length > 20) { photoMessage.value = 'Choose up to 20 photos at a time.'; return }
  savingPhoto.value = true
  photoMessage.value = ''
  try {
    const images = []
    for (const file of files) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Each photo must be PNG, JPG or WebP and smaller than 5 MB.')
    }
    photoMessage.value = `Preparing photo ${images.length + 1} of ${files.length}…`
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const image = canvas.toDataURL('image/png').split(',')[1]
    if (image.length > 7 * 1024 * 1024) throw new Error('A converted photo is too large. Choose a smaller image.')
    images.push(image)
    }
    photoMessage.value = `Saving ${files.length} photos…`
    const response = await editorFetch('/api/admin/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heading, images }),
    })
    if (!response.ok) throw new Error(await response.text())
    photoHeading.value = ''
    photoInput.value.value = ''
    photoMessage.value = `${files.length} photos added to ${heading}.`
  } catch (error) {
    photoMessage.value = error.message || 'Could not add the photo. Please try again.'
  } finally {
    savingPhoto.value = false
  }
}
const itemEditorOpen = ref(false)
const itemTopic = ref('')
const itemName = ref('')
const savingItem = ref(false)
const itemMessage = ref('')
const removingItem = ref(false)
const removeItemMessage = ref('')
async function removeItem(topic, name) {
  const wholeSection = name === undefined
  const question = wholeSection ? `Remove the section "${topic}" and all its items?` : `Remove "${name}" from "${topic}"?`
  if (!window.confirm(question)) return
  removingItem.value = true
  removeItemMessage.value = ''
  try {
    const response = await editorFetch('/api/admin/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: wholeSection ? 'delete-topic' : 'delete-item', topic, name }),
    })
    if (!response.ok) throw new Error(await response.text())
    removeItemMessage.value = await response.text()
  } catch (error) {
    removeItemMessage.value = error.message || 'Could not remove the item or section.'
  } finally {
    removingItem.value = false
  }
}
async function addItem() {
  savingItem.value = true
  itemMessage.value = ''
  try {
    const response = await editorFetch('/api/admin/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: itemTopic.value, name: itemName.value }),
    })
    if (!response.ok) throw new Error(await response.text())
    itemName.value = ''
    itemMessage.value = await response.text()
  } catch (error) {
    itemMessage.value = error.message || 'Could not add the item.'
  } finally {
    savingItem.value = false
  }
}
const route = ref(window.location.hash || '#home')
const menuOpen = ref(false)
const stickyMenu = ref(null)
let menuResizeObserver
onMounted(() => {
  const updateMenuHeight = () => {
    document.documentElement.style.setProperty('--menu-height', `${stickyMenu.value.getBoundingClientRect().height}px`)
  }
  updateMenuHeight()
  menuResizeObserver = new ResizeObserver(updateMenuHeight)
  menuResizeObserver.observe(stickyMenu.value)
})
onUnmounted(() => {
  menuResizeObserver?.disconnect()
  document.documentElement.style.removeProperty('--menu-height')
})
const isGallery = /^\/gallery\/?$/.test(window.location.pathname)
const page = computed(() => isLogin ? 'login' : isGallery ? 'gallery' : route.value === '#about' ? 'about' : route.value === '#catalogues' ? 'catalogues' : 'home')
function navigate() { route.value = window.location.hash || '#home'; menuOpen.value = false; if (['#home', '#about', '#catalogues'].includes(route.value)) window.scrollTo(0, 0) }
onMounted(() => window.addEventListener('hashchange', navigate))
onUnmounted(() => window.removeEventListener('hashchange', navigate))
const directions = 'https://maps.app.goo.gl/DpkR3AsjUxGMbEXUA'
const mapPreview = 'https://www.google.com/maps?cid=523963738585611070&output=embed'
</script>

<template>
  <div class="topbar"><span class="topbar-label">Call us</span><a href="tel:+917012891724" aria-label="Call mobile +91 70128 91724"><svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 3 3 5-3 3a16 16 0 0 0 6 6l3-3 5 3v3a2 2 0 0 1-2 2C9 21 3 15 2 5a2 2 0 0 1 2-2Z"/></svg><span>+91 70128 91724</span></a><a href="tel:+914912501145" aria-label="Call landline 0491 2501145"><svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9V5c4-3 14-3 18 0v4h-5V6H8v3Z"/><path d="m7 11-4 7v3h18v-3l-4-7Z"/><circle cx="12" cy="16" r="2"/></svg><span>0491 2501145</span></a></div>
  <div v-if="canEdit" class="editor-toolbar wrap"><span>Editing website</span><a href="/#shops">Shops &amp; items</a><a href="/gallery">Gallery</a><button type="button" @click="signOut">Sign out</button></div>
  <p v-if="editorMessage" class="wrap editor-notice" role="status">{{ editorMessage }} <a v-if="!canEdit" href="/login">Sign in</a></p>
  <div v-if="canEdit && !isLogin" class="logo-editor wrap">
    <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="uploadLogo" />
    <button type="button" :disabled="uploading" @click="logoInput.click()">{{ uploading ? 'Saving logo…' : 'Upload logo photo' }}</button>
    <span role="status">{{ uploadMessage || 'PNG, JPG or WebP · Up to 5 MB' }}</span>
  </div>
  <div ref="stickyMenu" class="sticky-menu">
  <header class="header wrap">
    <a class="brand" href="/#home" aria-label="Chettiyar Kada home"><img v-if="logoUrl" class="brand-logo" :src="logoUrl" alt="" /><span v-else class="brand-mark">CK<span>✦</span></span><span class="brand-name">CHETTIYAR KADA<small>PALAKKAD, KERALA</small></span></a>
    <button class="menu-toggle" @click="menuOpen = !menuOpen" :aria-expanded="menuOpen" aria-controls="navigation">Menu ☰</button>
    <nav id="navigation" :class="{ open: menuOpen }" aria-label="Main navigation"><a href="/#home" :aria-current="page === 'home' ? 'page' : undefined">Home</a><a href="/#shops">Our shops</a><a :href="catalogue.url">Catalogue</a><a href="/#our-items">Our Items</a><a href="/gallery" :aria-current="page === 'gallery' ? 'page' : undefined">Gallery</a><a href="/#about" :aria-current="page === 'about' ? 'page' : undefined">About us</a><a class="nav-visit" href="/#contact">Visit us <span>↗</span></a></nav>
  </header>
  </div>
  <main id="main">
    <section v-if="isLogin" class="login-page wrap">
      <p class="eyebrow">CHETTIYAR KADA</p><h1>Website <em>login</em></h1>
      <p>Sign in to manage shop photos, your logo, gallery and items.</p>
      <p v-if="checkingSession" role="status">Checking your session…</p>
      <div v-else-if="canEdit"><p>You’re signed in.</p><a class="button" href="/#shops">Edit website →</a></div>
      <form v-else class="gallery-editor login-form" @submit.prevent="signIn">
        <label for="login-username">Username</label><input id="login-username" v-model="username" autocomplete="username" required maxlength="120" :disabled="signingIn" />
        <label for="login-password">Password</label><input id="login-password" v-model="password" type="password" autocomplete="current-password" required maxlength="256" :disabled="signingIn" />
        <button class="button" type="submit" :disabled="signingIn">{{ signingIn ? 'Signing in…' : 'Sign in' }}</button>
        <p role="alert">{{ loginMessage }}</p>
      </form>
    </section>
    <section v-if="page === 'home'" id="shops" class="section wrap"><div class="section-heading"><div><p class="eyebrow">MEET OUR SHOPS</p><h2 class="shops-caption">A Vast Collection of <em>Rare House Hold Articles</em></h2></div></div><div class="shop-grid"><article v-for="(shop, index) in shops" :key="shop.name" class="shop-card"><div class="shop-photos"><div v-for="photo in shop.photos" :key="photo.source" class="photo-space" :class="'photo-' + index"><img :src="photo.src" :alt="shop.name" /></div><div v-if="!shop.photos.length" class="photo-space" :class="'photo-' + index"><span class="photo-icon" aria-hidden="true">▧</span><span>A glimpse of our shop</span><small>PHOTOS COMING SOON</small></div></div><div class="shop-details"><h3>{{ shop.name }}</h3><div v-if="canEdit" class="shop-photo-editor"><input :id="'shop-photo-' + index" type="file" accept="image/png,image/jpeg,image/webp" hidden :disabled="shopUploads[index]" @change="uploadShopPhoto($event, index)" /><button class="button" type="button" :disabled="shopUploads[index]" :aria-label="'Upload photo for ' + shop.name" @click="$event.currentTarget.previousElementSibling.click()">{{ shopUploads[index] ? 'Saving photo…' : 'Upload photo' }}</button><p role="status">{{ shopMessages[index] || 'PNG, JPG or WebP · Up to 5 MB' }}</p></div></div></article></div></section>
    <section v-if="page === 'gallery'" class="gallery-page wrap">
      <p class="eyebrow">A CLOSER LOOK AT CHETTIYAR KADA</p>
      <h1>Our <em>Gallery</em></h1>
      <p class="gallery-intro">Discover our shops and our collection of household articles.</p>
      <form v-if="canEdit" class="gallery-editor" @submit.prevent="addGalleryPhoto">
        <h2>Add photos to a section</h2>
        <label for="photo-heading">Section name</label>
        <input id="photo-heading" list="gallery-sections" v-model="photoHeading" type="text" maxlength="120" required :disabled="savingPhoto" placeholder="For example, Traditional kitchenware" />
        <datalist id="gallery-sections"><option v-for="section in gallerySections" :key="section.name" :value="section.name" /></datalist>
        <label for="gallery-photo">Photos</label>
        <input id="gallery-photo" ref="photoInput" type="file" multiple accept="image/png,image/jpeg,image/webp" required :disabled="savingPhoto" aria-describedby="photo-help" />
        <p id="photo-help">Select up to 20 photos · PNG, JPG or WebP · Up to 5 MB each. Use an existing section name to add more photos.</p>
        <button class="button" type="submit" :disabled="savingPhoto">{{ savingPhoto ? 'Saving photos…' : 'Add photos' }}</button>
        <p role="status">{{ photoMessage }}</p>
      </form>
      <p v-if="canEdit" role="status">{{ renameMessage }}</p>
      <p v-if="canEdit" role="status">{{ deleteMessage }}</p>
      <div v-if="gallery.length">
        <section v-for="section in gallerySections" :key="section.name" class="gallery-section">
        <div class="gallery-section-heading"><h2>{{ section.name }}</h2><button v-if="canEdit && section.photos.some(photo => photo.editable !== false)" type="button" :disabled="savingSection" :aria-label="'Rename section ' + section.name" @click="startRename(section.name)">Rename</button></div>
        <form v-if="canEdit && renamingSection === section.name" class="section-rename" @submit.prevent="renameSection">
          <label>Section name <input v-model="sectionName" required maxlength="120" :disabled="savingSection" /></label>
          <button type="submit" :disabled="savingSection">{{ savingSection ? 'Saving…' : 'Save name' }}</button>
          <button type="button" :disabled="savingSection" @click="renamingSection = ''; renameMessage = ''">Cancel</button>
        </form>
        <div class="gallery-grid">
        <figure v-for="photo in section.photos" :key="photo.src">
          <button class="gallery-photo-button" type="button" :aria-label="'Enlarge photo: ' + photo.alt" @click="enlargePhoto(photo, $event)"><img :src="photo.src" :alt="photo.alt" loading="lazy" /></button>
          <button v-if="canEdit && photo.editable !== false" class="delete-photo-button" type="button" :disabled="!!deletingPhoto" :aria-label="'Delete photo: ' + photo.alt" @click="deletePhoto(photo)">{{ deletingPhoto === photo.src ? 'Deleting…' : 'Delete photo' }}</button>
        </figure>
        </div>
        </section>
      </div>
      <div v-else class="gallery-empty"><span aria-hidden="true">▧</span><h2>Photos coming soon</h2><p>We’re getting our gallery ready. Visit us to explore the collection in person.</p><a class="button" href="/#contact">Find us</a></div>
    </section>
    <template v-if="page === 'home'">
      <div class="values"><span>THREE DISTINCT SHOPS</span><i>✦</i><span>ONE FAMILY</span><i>✦</i><span>IN THE HEART OF PALAKKAD</span></div>
    </template>

    <template v-if="page === 'about'">
      <section class="about-intro wrap" aria-labelledby="about-title">
        <p class="eyebrow">CHETTIYAR KADA · PALAKKAD</p>
        <h1 id="about-title">About <em>Us</em></h1>
        <div class="about-columns">
          <p>Welcome to Chettiyar Kada in Palakkad. Our family of shops brings together New Chettiyar Kada, Chettiyar Kada Super store, and Chettiyar Kada Traditional Stores.</p>
          <p>Explore our collection of household articles, get in touch to ask about products and availability, or visit us on Market Road. We look forward to welcoming you.</p>
        </div>
      </section>
      <section class="about-history section wrap" aria-labelledby="history-title">
        <p class="eyebrow">OUR STORY</p>
        <h2 id="history-title">Our <em>History</em></h2>
        <p>We look forward to sharing the story of Chettiyar Kada here soon.</p>
      </section>
    </template>


    <section v-if="page === 'home' || page === 'catalogues'" id="our-items" class="catalogue-section">
      <div class="wrap">
        <div class="section-heading"><div><h2>Our <em>Items</em></h2></div><button v-if="canEditItems" class="button items-add-button" type="button" :aria-expanded="itemEditorOpen" aria-controls="items-editor" @click="itemEditorOpen = !itemEditorOpen">{{ itemEditorOpen ? 'Close editor' : 'Add topic / item' }}</button></div>
        <form v-if="canEditItems && itemEditorOpen" id="items-editor" class="gallery-editor" @submit.prevent="addItem">
          <label for="item-topic">Topic</label>
          <input id="item-topic" v-model="itemTopic" list="item-topics" maxlength="120" required :disabled="savingItem" placeholder="For example, Kitchenware" />
          <datalist id="item-topics"><option v-for="topic in itemTopics" :key="topic.topic" :value="topic.topic" /></datalist>
          <label for="item-name">Item names (comma-separated)</label>
          <input id="item-name" v-model="itemName" maxlength="12000" required :disabled="savingItem" placeholder="Brass cooking pot, Plates, Tumblers" />
          <button class="button" type="submit" :disabled="savingItem">{{ savingItem ? 'Saving…' : 'Add items' }}</button>
          <p role="status">{{ itemMessage }}</p>
        </form>
        <div v-if="itemTopics.length" class="items-grid"><article v-for="topic in itemTopics" :key="topic.topic" class="items-topic"><div class="items-topic-heading"><h3>{{ topic.topic }}</h3><button v-if="canEditItems" class="item-remove" type="button" :disabled="removingItem" :aria-label="'Remove section ' + topic.topic" title="Remove section" @click="removeItem(topic.topic)">×</button></div><ul><li v-for="item in topic.items" :key="item"><span>{{ item }}</span><button v-if="canEditItems" class="item-remove" type="button" :disabled="removingItem" :aria-label="'Remove item ' + item" title="Remove item" @click="removeItem(topic.topic, item)">×</button></li></ul></article></div>
        <p v-else-if="itemsLoading" class="items-empty" role="status">Loading our items…</p><p v-else-if="!itemsAvailable" class="items-empty" role="status">Our items are temporarily unavailable. Please try again later.</p><p v-else class="items-empty">Our item collection is coming soon. Browse the catalogue to explore what’s available.</p>
        <p v-if="canEditItems" role="status">{{ removeItemMessage }}</p>
        <p class="catalogue-help"><a :href="catalogue.url">View full catalogue →</a></p>
      </div>
    </section>

    <section v-if="page !== 'gallery' && page !== 'login'" id="contact" class="contact wrap">
      <div><p class="eyebrow">COME SAY HELLO</p><h2>Use Maps to <em>Find Us</em></h2></div>
      <div class="map-preview"><iframe :src="mapPreview" title="Map showing New Chettiyar Kada in Palakkad" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><a :href="directions" target="_blank" rel="noopener noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a></div>
      <div class="contact-card">
        <div><svg class="contact-icon address-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg><div><p class="eyebrow">OUR ADDRESS</p><address>41/2395 First Floor<br>Market Road<br>Palakkad</address></div></div>
        <div><div class="contact-numbers"><p class="eyebrow">CONTACT NUMBERS</p>
          <div class="phone-row"><a class="phone-link" href="tel:+917012891724" aria-label="Call mobile 7012891724"><svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 3 3 5-3 3a16 16 0 0 0 6 6l3-3 5 3v3a2 2 0 0 1-2 2C9 21 3 15 2 5a2 2 0 0 1 2-2Z"/></svg><span>7012891724 <small>Mobile</small></span></a><a class="whatsapp-link" href="https://wa.me/917012891724" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp 7012891724" title="Chat on WhatsApp"><svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z"/><path d="m8 7 2 3-1.3 1.3a9 9 0 0 0 4 4L14 14l3 2c-1 3-4 2-7-1s-4-6-2-8Z"/></svg></a></div>
          <div class="phone-row"><a class="phone-link" href="tel:+914912501145" aria-label="Call landline 0491 2501145"><svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9V5c4-3 14-3 18 0v4h-5V6H8v3Z"/><path d="m7 11-4 7v3h18v-3l-4-7Z"/><circle cx="12" cy="16" r="2"/></svg><span>0491 2501145 <small>Landline</small></span></a></div>
        </div></div>
      </div>
    </section>
    <dialog ref="photoDialog" class="photo-dialog" aria-label="Enlarged gallery photo" @keydown.left.prevent="movePhoto(-1)" @keydown.right.prevent="movePhoto(1)" @cancel.prevent="closePhoto" @click="($event.target === photoDialog) && closePhoto()">
      <div v-if="enlargedPhoto" class="photo-dialog-content">
        <button class="photo-dialog-close" type="button" autofocus aria-label="Close enlarged photo" @click="closePhoto">Close ×</button>
        <img :src="enlargedPhoto.src" :alt="enlargedPhoto.alt" />
        <div class="photo-navigation">
          <button v-if="viewerPhotos.length > 1" type="button" aria-label="Previous photo" @click="movePhoto(-1)">←</button>
          <p aria-live="polite" aria-atomic="true">{{ enlargedPhoto.section || enlargedPhoto.caption || enlargedPhoto.alt }}<small>{{ viewerIndex + 1 }} / {{ viewerPhotos.length }}</small></p>
          <button v-if="viewerPhotos.length > 1" type="button" aria-label="Next photo" @click="movePhoto(1)">→</button>
        </div>
      </div>
    </dialog>
  </main>
  <footer><div class="wrap footer-main"><a class="brand" href="/#home"><img v-if="logoUrl" class="brand-logo" :src="logoUrl" alt="" /><span v-else class="brand-mark">CK<span>✦</span></span><span class="brand-name">CHETTIYAR KADA</span></a><div><a href="/#shops">Our shops</a><a :href="catalogue.url">Catalogue</a><a href="/#our-items">Our Items</a><a href="/gallery" :aria-current="page === 'gallery' ? 'page' : undefined">Gallery</a><a href="/#about">About us</a><a href="/#contact">Contact</a></div></div><div class="wrap footer-bottom"><span>© {{ new Date().getFullYear() }} Chettiyar Kada. All rights reserved.</span><a href="/login">Website login</a><span>With warmth, from Palakkad. <b>✳</b></span></div></footer>
</template>
