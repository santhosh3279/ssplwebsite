// Add public image paths (for example /photos/new-chettiyar-kada.jpg)
// below when they are ready.
export const shops = [
  { name: 'New Chettiyar Kada', photo: '' },
  { name: 'Chettiyar Kada Super store', photo: '' },
  { name: 'Chettiyar Kada Traditional Stores', photo: '' },
]

// One shared catalogue for all three shops. Add its HTTPS URL or public PDF path.
export const catalogue = { url: 'https://billing.chettiyarkada.in/frontend/catelogue' }

// Add photos stored in public/gallery, with descriptive alt text.
// Example: { src: '/gallery/shop.jpg', alt: 'Inside New Chettiyar Kada', caption: 'Our shop' }
export { default as gallery } from './gallery.json'
