<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { shops, catalogue, gallery } from './content'
import logo from './logo.json'
const isDevelopment = import.meta.env.DEV
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
    const response = await fetch('/__dev/logo', { method: 'POST', body: blob })
    if (!response.ok) throw new Error(await response.text())
    logoUrl.value = `/logo.png?v=${Date.now()}`
    uploadMessage.value = 'Logo saved.'
  } catch (error) {
    uploadMessage.value = error.message || 'Could not upload the logo. Please try again.'
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}
const photoHeading = ref('')
const photoInput = ref(null)
const savingPhoto = ref(false)
const photoMessage = ref('')
async function addGalleryPhoto() {
  const file = photoInput.value.files?.[0]
  if (!file || !photoHeading.value.trim()) { photoMessage.value = 'Choose a photo and enter its heading.'; return }
  savingPhoto.value = true
  photoMessage.value = ''
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Choose a PNG, JPG or WebP image smaller than 5 MB.')
    }
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const response = await fetch('/__dev/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heading: photoHeading.value.trim(), image: canvas.toDataURL('image/png').split(',')[1] }),
    })
    if (!response.ok) throw new Error(await response.text())
    photoHeading.value = ''
    photoInput.value.value = ''
    photoMessage.value = 'Photo added.'
  } catch (error) {
    photoMessage.value = error.message || 'Could not add the photo. Please try again.'
  } finally {
    savingPhoto.value = false
  }
}
const route = ref(window.location.hash || '#home')
const menuOpen = ref(false)
const isGallery = /^\/gallery\/?$/.test(window.location.pathname)
const page = computed(() => isGallery ? 'gallery' : route.value === '#about' ? 'about' : route.value === '#catalogues' ? 'catalogues' : 'home')
function navigate() { route.value = window.location.hash || '#home'; menuOpen.value = false; if (['#home', '#about', '#catalogues'].includes(route.value)) window.scrollTo(0, 0) }
onMounted(() => window.addEventListener('hashchange', navigate))
onUnmounted(() => window.removeEventListener('hashchange', navigate))
const directions = 'https://maps.app.goo.gl/DpkR3AsjUxGMbEXUA'
const mapPreview = 'https://www.google.com/maps?cid=523963738585611070&output=embed'
</script>

<template>
  <div class="topbar"><span>Three shops. One familiar name.</span><a href="tel:+917012891724">Call us <span>+91 70128 91724 ↗</span></a></div>
  <div v-if="isDevelopment" class="logo-editor wrap">
    <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="uploadLogo" />
    <button type="button" :disabled="uploading" @click="logoInput.click()">{{ uploading ? 'Saving logo…' : 'Upload logo photo' }}</button>
    <span role="status">{{ uploadMessage || 'PNG, JPG or WebP · Up to 5 MB' }}</span>
  </div>
  <header class="header wrap">
    <a class="brand" href="/#home" aria-label="Chettiyar Kada home"><img v-if="logoUrl" class="brand-logo" :src="logoUrl" alt="" /><span v-else class="brand-mark">CK<span>✦</span></span><span class="brand-name">CHETTIYAR KADA<small>PALAKKAD, KERALA</small></span></a>
    <button class="menu-toggle" @click="menuOpen = !menuOpen" :aria-expanded="menuOpen" aria-controls="navigation">Menu ☰</button>
    <nav id="navigation" :class="{ open: menuOpen }" aria-label="Main navigation"><a href="/#home" :aria-current="page === 'home' ? 'page' : undefined">Home</a><a href="/#shops">Our shops</a><a :href="catalogue.url">Catalogue</a><a href="/gallery" :aria-current="page === 'gallery' ? 'page' : undefined">Gallery</a><a href="/#about" :aria-current="page === 'about' ? 'page' : undefined">About us</a><a class="nav-visit" href="/#contact">Visit us <span>↗</span></a></nav>
  </header>
  <main id="main">
    <section v-if="page === 'gallery'" class="gallery-page wrap">
      <p class="eyebrow">A CLOSER LOOK AT CHETTIYAR KADA</p>
      <h1>Our <em>Gallery</em></h1>
      <p class="gallery-intro">Discover our shops and our collection of household articles.</p>
      <form v-if="isDevelopment" class="gallery-editor" @submit.prevent="addGalleryPhoto">
        <h2>Add a gallery photo</h2>
        <label for="photo-heading">Photo heading</label>
        <input id="photo-heading" v-model="photoHeading" type="text" maxlength="120" required :disabled="savingPhoto" placeholder="For example, Traditional kitchenware" />
        <label for="gallery-photo">Photo</label>
        <input id="gallery-photo" ref="photoInput" type="file" accept="image/png,image/jpeg,image/webp" required :disabled="savingPhoto" aria-describedby="photo-help" />
        <p id="photo-help">PNG, JPG or WebP · Up to 5 MB</p>
        <button class="button" type="submit" :disabled="savingPhoto">{{ savingPhoto ? 'Saving photo…' : 'Add photo' }}</button>
        <p role="status">{{ photoMessage }}</p>
      </form>
      <div v-if="gallery.length" class="gallery-grid">
        <figure v-for="photo in gallery" :key="photo.src">
          <a :href="photo.src" target="_blank" rel="noopener noreferrer" :aria-label="'View photo: ' + photo.alt"><img :src="photo.src" :alt="photo.alt" loading="lazy" /></a>
          <figcaption v-if="photo.caption"><h2>{{ photo.caption }}</h2></figcaption>
        </figure>
      </div>
      <div v-else class="gallery-empty"><span aria-hidden="true">▧</span><h2>Photos coming soon</h2><p>We’re getting our gallery ready. Visit us to explore the collection in person.</p><a class="button" href="/#contact">Find us</a></div>
    </section>
    <template v-if="page === 'home'">
      <section class="hero wrap">
        <div class="hero-copy"><p class="eyebrow"><span class="little-line"></span> YOUR NEIGHBOURHOOD SHOPS IN PALAKKAD</p><h1>A Vast Collection of<br><em>Rare House Hold Articles</em></h1><p class="intro">Welcome to Chettiyar Kada. Discover our three shops, explore what’s in store, and come say hello on Market Road.</p><div class="actions"><a class="button" href="/#shops">Explore our shops <span>↗</span></a><a class="text-link" href="/#about">Get to know us <span>→</span></a></div><div class="hero-note"><span class="small-star">✳</span> Rooted in Palakkad. Here for you.</div></div>
        <div class="hero-art" role="img" aria-label="Decorative illustration of a Chettiyar Kada shop"><div class="art-caption">THE CHETTIYAR KADA COLLECTION <span>01 — 03</span></div><div class="sun"></div><div class="arch"><div class="store"><div class="store-roof"></div><div class="store-sign">CHETTIYAR KADA<small>WELCOME TO OUR SHOPS</small></div><div class="awning"></div><div class="store-front"><div class="window"><i></i><i></i><i></i><span>✦</span></div><div class="door"><span>OPEN</span></div><div class="window"><i></i><i></i><i></i><span>✦</span></div></div><div class="step"></div></div><div class="plant plant-left">✳<span>▰</span></div><div class="plant plant-right">✳<span>▰</span></div></div><div class="art-bottom"><span>A little local.<br>A lot of heart.</span><span class="round-seal">THREE SHOPS<br><b>✳</b><br>ONE NAME</span></div></div>
      </section>
      <div class="values"><span>THREE DISTINCT SHOPS</span><i>✦</i><span>ONE CHETTIYAR KADA FAMILY</span><i>✦</i><span>IN THE HEART OF PALAKKAD</span></div>
    </template>

    <section v-if="page === 'about'" class="about-intro wrap"><p class="eyebrow">A NAME THAT BRINGS US TOGETHER</p><h1>Three shops.<br><em>One local connection.</em></h1><div class="about-columns"><p>Welcome to Chettiyar Kada in Palakkad. Our family of shops brings together New Chettiyar Kada, Chettiyar Kada Super store, and Chettiyar Kada Traditional Stores.</p><p>Explore each shop below, get in touch to ask about products and availability, or visit us on Market Road. We look forward to welcoming you.</p></div></section>

    <section v-if="page === 'home' || page === 'about'" id="shops" class="section wrap"><div class="section-heading"><div><p class="eyebrow">MEET OUR SHOPS</p><h2>Three names. <em>One family.</em></h2></div><p>Find your familiar favourite.<br>Discover somewhere new.</p></div><div class="shop-grid"><article v-for="(shop, index) in shops" :key="shop.name" class="shop-card"><div class="photo-space" :class="'photo-' + index"><img v-if="shop.photo" :src="shop.photo" :alt="shop.name" /><template v-else><span class="photo-icon" aria-hidden="true">▧</span><span>A glimpse of our shop</span><small>PHOTOS COMING SOON</small></template><span class="shop-number">0{{ index + 1 }}</span></div><div class="shop-details"><p class="eyebrow">CHETTIYAR KADA · PALAKKAD</p><h3>{{ shop.name }}</h3><a :href="'tel:+917012891724'">Enquire about this shop <span>↗</span></a></div></article></div></section>

    <section v-if="page !== 'gallery'" id="catalogue-section" class="catalogue-section" :class="{ 'full-catalogue': page === 'catalogues' }"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">TAKE A CLOSER LOOK</p><h2>Our <em>catalogue.</em></h2></div><p>More to discover, all in one place.<br>Browse our shared catalogue online.</p></div><div class="catalogue-list"><div class="catalogue-row"><span class="catalogue-icon">▤</span><span class="catalogue-name"><small>ALL THREE SHOPS</small><h3>Chettiyar Kada Catalogue</h3></span><a v-if="catalogue.url" class="catalogue-link" :href="catalogue.url">View catalogue ↗</a><span v-else class="coming-soon">Coming soon <span>↗</span></span></div></div><p class="catalogue-help">Looking for something specific? <a href="tel:+917012891724">Give us a call →</a></p></div></section>

    <section v-if="page !== 'gallery'" id="contact" class="contact wrap">
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
  </main>
  <footer><div class="wrap footer-main"><a class="brand" href="/#home"><img v-if="logoUrl" class="brand-logo" :src="logoUrl" alt="" /><span v-else class="brand-mark">CK<span>✦</span></span><span class="brand-name">CHETTIYAR KADA<small>THREE SHOPS. ONE FAMILIAR NAME.</small></span></a><div><a href="/#shops">Our shops</a><a :href="catalogue.url">Catalogue</a><a href="/gallery" :aria-current="page === 'gallery' ? 'page' : undefined">Gallery</a><a href="/#about">About us</a><a href="/#contact">Contact</a></div></div><div class="wrap footer-bottom"><span>© {{ new Date().getFullYear() }} Chettiyar Kada. All rights reserved.</span><span>With warmth, from Palakkad. <b>✳</b></span></div></footer>
</template>
