# Chettiyar Kada

Vue + Vite website for the three Chettiyar Kada shops in Palakkad.

## Run and sign in

```sh
npm install
npm run dev
```

The development server listens on `0.0.0.0`. Open `/login` and sign in as **swarna** with the configured password to edit photos. The same login enables the production editors and a sign-out toolbar.

**Production login and content require the Node backend.** Follow [deployment instructions](deploy/README.md). Pulling only static files does not enable login or production items.

## Development and production photos

Development uploads save images in `public/` and metadata in `src/shops.json`, `src/gallery.json`, and `src/logo.json`. Build, commit and push to publish those photos.

Production uploads save separately in the server's persistent `DATA_DIR`, outside Git, and use `/production-media/` URLs. The website combines development and production shop photos and gallery entries. Uploading a shop photo replaces only that environment's photo. Both photos appear when a shop has one from each source. The brand uses the production logo when available, otherwise the development logo.

Development previews also read production uploads from `https://www.chettiyarkada.in/api/content`. Override the address with `PRODUCTION_ORIGIN` when starting Vite. If the production API is unavailable, local photos remain visible.

Signed-in upload controls accept PNG, JPG or WebP images up to 5 MB. Shop and gallery photos are resized to at most 1600 pixels; logos to 1024 pixels. Empty shop photo paths show placeholders.

## Gallery

Visit `/gallery`. Upload up to 20 photos at once and enter a section name, or choose an existing name to add photos to that section. Section names differing only in capitalization or spacing are grouped together.

Click a photo to enlarge it. Navigate with the arrow buttons or Left/Right keys. Close with the Close button, Escape, or a click outside the image panel.

Each environment can rename or delete only its own gallery photos. Imported photos are visible without editing controls. Deleting the final photo in a section removes that section. Development edits require a rebuild to publish; production edits appear immediately.

## Our Items

Our Items comes **only from production server data**. There is no development JSON fallback in the browser. New production storage starts with an empty item list; existing production items remain intact during upgrades.

Sign in on the production website to add topics and comma-separated item names, remove items, or remove entire topics. Reuse a topic to add more items. Spaces and duplicate names are normalized. Deletion asks for confirmation.

Development displays the live production list read-only and rejects item write requests. When the production API is unavailable, the page shows an unavailable message instead of development items.

## Pages and catalogue

Home: `/#home`; shops: `/#shops`; About: `/#about`; items: `/#our-items`; gallery: `/gallery`; login: `/login`.

The shared catalogue link is configured in `src/content.js`. It currently opens `https://billing.chettiyarkada.in/frontend/catelogue`. Contact details are in `src/App.vue`.

## Build, test and deploy

```sh
npm test
npm run build
```

The committed `dist/` folder includes static entry pages for `/gallery` and `/login`. After every successful build, commit the task's source changes and generated files, then push the current branch to origin. Include development uploads when publishing photo changes.

The production Node backend serves built assets, merges both photo sets, and saves live content independently of Git. Follow [the deployment guide](deploy/README.md) for Nginx, systemd, persistent storage, migration, and updates. The VM does not need to build the frontend.

The About Us page (`/#about`) contains the introduction, Our History section, and existing address, map, and phone numbers. Replace the history placeholder in `src/App.vue` when the business history is provided.
