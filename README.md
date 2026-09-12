# Chettiyar Kada

Vue + Vite website for the three Chettiyar Kada shops in Palakkad.

## Run

```sh
npm install
npm run dev
```

The development server listens on `0.0.0.0`. Run `npm run build` to generate the production website in `dist`.

## Add photos and the catalogue

Run `npm run dev` and click **Upload photo** beneath any of the three shop names. Choose a PNG, JPG or WebP image up to 5 MB. Photos are resized to at most 1600 pixels and saved in `public/photos/`; `src/shops.json` records each shop's photo. Upload again to replace a shop photo. Controls and upload storage are available only on the development server, matching the logo and gallery editors. Rebuild and commit the photos, metadata, and `dist/` to publish them.

You can also edit photo paths in `src/shops.json` manually. Empty paths display placeholders. The shared catalogue URL is in `src/content.js`.

Set `catalogue.url` to a full HTTPS link or a PDF path such as `/catalogues/chettiyar-kada.pdf` (with the PDF stored in `public/catalogues/`). An empty catalogue URL displays “Coming soon”.

## Pages

Home: `#home`; About: `#about`; Catalogue links open `https://billing.chettiyarkada.in/frontend/catelogue` in the same tab. The shop and contact navigation links lead to their corresponding sections. Contact numbers and the supplied address are in `src/App.vue`.

## Production deployment without building on the server

The production `dist/` folder is committed to Git. On the development machine, rebuild after changing source files, photos, or catalogue links and commit the generated files together with the source changes:

```sh
npm run build
git add -A
git commit -m "Update website and production build"
git push origin main
```

On the Nginx VM, clone this repository once (for example to `/var/www/ssplwebsite`) and configure the site's Nginx `root` as `/var/www/ssplwebsite/dist`. Serve only `dist`, not the repository root. Ensure the Nginx worker can read this directory.

For future updates on the Nginx VM:

```sh
cd /var/www/ssplwebsite
git pull --ff-only origin main
```

No Node.js, npm installation, or build is required on the Nginx VM. An Nginx reload is only needed when its configuration changes.

## Upload the logo in development

Run `npm run dev` and click **Upload logo photo** above the header. Choose a PNG, JPG or WebP image up to 5 MB. The image is resized to at most 1024 pixels and saved as `public/logo.png`; `src/logo.json` records its path. It appears in both the header and footer and persists after restarting development. Rebuild and commit these files along with `dist/` to publish the logo. The upload button and endpoint are available only on the development server.

## Gallery

Visit `/gallery` using the Gallery link in the header or footer. Add images under `public/gallery/` and entries to `src/gallery.json` with `src`, descriptive `alt`, and optional `caption` fields. Until photos are added, the page shows “Photos coming soon”. Clicking a photo enlarges it in an overlay. Close it with the Close button, Escape, or a click outside the image panel.

The production build also generates `dist/gallery/index.html`, so Nginx can serve `/gallery` (redirecting to `/gallery/`) with the existing `try_files $uri $uri/ =404` configuration.

On the development gallery page, use **Add a gallery photo** to choose an image and enter its heading, then click **Add photo**. Photos are saved under `public/gallery/`, and headings in `src/gallery.json`. They persist across restarts and are included in the next production build. Upload controls and the endpoint are development-only.

Gallery uploads accept up to 20 photos at once (5 MB each). Enter a **Section name** or choose an existing suggestion. Photos are grouped beneath that heading; names differing only in capitalization or spacing are grouped together. Existing photo captions are used as section headings for older uploads.

In development, click **Rename** beside a gallery section, edit the section name, and choose **Save name**. All photos in that section move under the updated heading. Existing section names cannot be reused when renaming, to avoid accidental merging.

The enlarged gallery viewer has previous/next arrow buttons and supports the keyboard Left/Right keys. Navigation follows gallery section order and wraps from the last photo to the first.

In development, each gallery photo has a **Delete photo** button. Confirm to remove it from the gallery and delete its uploaded file. A section disappears when its last photo is deleted. Rebuild to publish deletions.

## Our Items

The Our Items section replaces the homepage catalogue panel. In development, click **Add topic / item**, enter a topic and item name, then **Add item**. Reuse a topic to list more items beneath it. Entries are saved in `src/items.json` and included in production builds; editing controls only appear in development. The full catalogue remains accessible through the catalogue links.

The item names field accepts comma-separated values, for example `Plates, Tumblers, Brass cooking pot`. Each name becomes a separate item under the chosen topic. Extra spaces and empty entries are ignored, and duplicate names are skipped.

In development, use the **×** beside an item to remove it, or beside a topic heading to remove that section and all its items. Both actions ask for confirmation and save the changes in `src/items.json`.
