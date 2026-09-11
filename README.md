# Chettiyar Kada

Vue + Vite website for the three Chettiyar Kada shops in Palakkad.

## Run

```sh
npm install
npm run dev
```

The development server listens on `0.0.0.0`. Run `npm run build` to generate the production website in `dist`.

## Add photos and the catalogue

Edit `src/content.js`. Each shop has a `photo` path. The shared `catalogue` object has one `url` for all three shops.

Place shop photos in `public/photos/` and set `photo` to a path such as `/photos/new-chettiyar-kada.jpg`. Empty photo paths display designed placeholders. These are spaces for future photos; this static website does not include an upload dashboard or server storage.

Set `catalogue.url` to a full HTTPS link or a PDF path such as `/catalogues/chettiyar-kada.pdf` (with the PDF stored in `public/catalogues/`). An empty catalogue URL displays “Coming soon”.

## Pages

Home: `#home`; About: `#about`; Catalogue: `#catalogues`. The shop and contact navigation links lead to their corresponding sections. Contact numbers and the supplied address are in `src/App.vue`.

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
