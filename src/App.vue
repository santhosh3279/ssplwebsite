<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { shops, catalogue } from './content'
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
const route = ref(window.location.hash || '#home')
const menuOpen = ref(false)
const page = computed(() => route.value === '#about' ? 'about' : route.value === '#catalogues' ? 'catalogues' : 'home')
function navigate() { route.value = window.location.hash || '#home'; menuOpen.value = false; if (['#home', '#about', '#catalogues'].includes(route.value)) window.scrollTo(0, 0) }
onMounted(() => window.addEventListener('hashchange', navigate))
onUnmounted(() => window.removeEventListener('hashchange', navigate))
const directions = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('41/2395 First Floor Market Road Palakkad')
</script>

<template>
  <div class="topbar"><span>Three shops. One familiar name.</span><a href="tel:+917012891724">Call us <span>+91 70128 91724 ↗</span></a></div>
  <div v-if="isDevelopment" class="logo-editor wrap">
    <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="uploadLogo" />
    <button type="button" :disabled="uploading" @click="logoInput.click()">{{ uploading ? 'Saving logo…' : 'Upload logo photo' }}</button>
    <span role="status">{{ uploadMessage || 'PNG, JPG or WebP · Up to 5 MB' }}</span>
  </div>
  <header class="header wrap">
    <a class="brand" href="#home" aria-label="Chettiyar Kada home"><img v-if="logoUrl" class="brand-logo" :src="logoUrl" alt="" /><span v-else class="brand-mark">CK<span>✦</span></span><span>CHETTIYAR KADA<small>PALAKKAD, KERALA</small></span></a>
    <button class="menu-toggle" @click="menuOpen = !menuOpen" :aria-expanded="menuOpen" aria-controls="navigation">Menu ☰</button>
    <nav id="navigation" :class="{ open: menuOpen }" aria-label="Main navigation"><a href="#home" :aria-current="page === 'home' ? 'page' : undefined">Home</a><a href="#shops">Our shops</a><a :href="catalogue.url">Catalogue</a><a href="#about" :aria-current="page === 'about' ? 'page' : undefined">About us</a><a class="nav-visit" href="#contact">Visit us <span>↗</span></a></nav>
  </header>
  <main id="main">
    <template v-if="page === 'home'">
      <section class="hero wrap">
        <div class="hero-copy"><p class="eyebrow"><span class="little-line"></span> YOUR NEIGHBOURHOOD SHOPS IN PALAKKAD</p><h1>A familiar name.<br>A welcoming<br><em>place to shop.</em></h1><p class="intro">Welcome to Chettiyar Kada. Discover our three shops, explore what’s in store, and come say hello on Market Road.</p><div class="actions"><a class="button" href="#shops">Explore our shops <span>↗</span></a><a class="text-link" href="#about">Get to know us <span>→</span></a></div><div class="hero-note"><span class="small-star">✳</span> Rooted in Palakkad. Here for you.</div></div>
        <div class="hero-art" role="img" aria-label="Decorative illustration of a Chettiyar Kada shop"><div class="art-caption">THE CHETTIYAR KADA COLLECTION <span>01 — 03</span></div><div class="sun"></div><div class="arch"><div class="store"><div class="store-roof"></div><div class="store-sign">CHETTIYAR KADA<small>WELCOME TO OUR SHOPS</small></div><div class="awning"></div><div class="store-front"><div class="window"><i></i><i></i><i></i><span>✦</span></div><div class="door"><span>OPEN</span></div><div class="window"><i></i><i></i><i></i><span>✦</span></div></div><div class="step"></div></div><div class="plant plant-left">✳<span>▰</span></div><div class="plant plant-right">✳<span>▰</span></div></div><div class="art-bottom"><span>A little local.<br>A lot of heart.</span><span class="round-seal">THREE SHOPS<br><b>✳</b><br>ONE NAME</span></div></div>
      </section>
      <div class="values"><span>THREE DISTINCT SHOPS</span><i>✦</i><span>ONE CHETTIYAR KADA FAMILY</span><i>✦</i><span>IN THE HEART OF PALAKKAD</span></div>
    </template>

    <section v-if="page === 'about'" class="about-intro wrap"><p class="eyebrow">A NAME THAT BRINGS US TOGETHER</p><h1>Three shops.<br><em>One local connection.</em></h1><div class="about-columns"><p>Welcome to Chettiyar Kada in Palakkad. Our family of shops brings together New Chettiyar Kada, Chettiyar Kada Super store, and Chettiyar Kada Traditional Stores.</p><p>Explore each shop below, get in touch to ask about products and availability, or visit us on Market Road. We look forward to welcoming you.</p></div></section>

    <section v-if="page !== 'catalogues'" id="shops" class="section wrap"><div class="section-heading"><div><p class="eyebrow">MEET OUR SHOPS</p><h2>Three names. <em>One family.</em></h2></div><p>Find your familiar favourite.<br>Discover somewhere new.</p></div><div class="shop-grid"><article v-for="(shop, index) in shops" :key="shop.name" class="shop-card"><div class="photo-space" :class="'photo-' + index"><img v-if="shop.photo" :src="shop.photo" :alt="shop.name" /><template v-else><span class="photo-icon" aria-hidden="true">▧</span><span>A glimpse of our shop</span><small>PHOTOS COMING SOON</small></template><span class="shop-number">0{{ index + 1 }}</span></div><div class="shop-details"><p class="eyebrow">CHETTIYAR KADA · PALAKKAD</p><h3>{{ shop.name }}</h3><a :href="'tel:+917012891724'">Enquire about this shop <span>↗</span></a></div></article></div></section>

    <section id="catalogue-section" class="catalogue-section" :class="{ 'full-catalogue': page === 'catalogues' }"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">TAKE A CLOSER LOOK</p><h2>Our <em>catalogue.</em></h2></div><p>More to discover, all in one place.<br>Browse our shared catalogue online.</p></div><div class="catalogue-list"><div class="catalogue-row"><span class="catalogue-icon">▤</span><span class="catalogue-name"><small>ALL THREE SHOPS</small><h3>Chettiyar Kada Catalogue</h3></span><a v-if="catalogue.url" class="catalogue-link" :href="catalogue.url">View catalogue ↗</a><span v-else class="coming-soon">Coming soon <span>↗</span></span></div></div><p class="catalogue-help">Looking for something specific? <a href="tel:+917012891724">Give us a call →</a></p></div></section>

    <section id="contact" class="contact wrap"><div><p class="eyebrow">COME SAY HELLO</p><h2>Your next visit<br>starts <em>here.</em></h2><p>Find us on Market Road, Palakkad.<br>Call ahead for opening hours and product enquiries.</p><a class="button" :href="directions" target="_blank" rel="noopener noreferrer">Get directions <span>↗</span></a></div><div class="contact-card"><div><span class="contact-symbol">⌖</span><div><p class="eyebrow">OUR ADDRESS</p><address>41/2395 First Floor<br>Market Road<br>Palakkad</address></div></div><div><span class="contact-symbol">↗</span><div><p class="eyebrow">LET’S TALK</p><a href="tel:+917012891724">7012891724 <small>Mobile</small></a><a href="tel:+914912501145">0491 2501145 <small>Landline</small></a></div></div></div></section>
  </main>
  <footer><div class="wrap footer-main"><a class="brand" href="#home"><img v-if="logoUrl" class="brand-logo" :src="logoUrl" alt="" /><span v-else class="brand-mark">CK<span>✦</span></span><span>CHETTIYAR KADA<small>THREE SHOPS. ONE FAMILIAR NAME.</small></span></a><div><a href="#shops">Our shops</a><a :href="catalogue.url">Catalogue</a><a href="#about">About us</a><a href="#contact">Contact</a></div></div><div class="wrap footer-bottom"><span>© {{ new Date().getFullYear() }} Chettiyar Kada. All rights reserved.</span><span>With warmth, from Palakkad. <b>✳</b></span></div></footer>
</template>
