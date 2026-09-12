# Enable login and live editing

The built `/login` page needs the Node backend; static Nginx hosting alone cannot sign in or save changes. The account is `swarna`, using the password supplied when this feature was requested. The server stores a salted password hash in `server/credentials.json`; it is never included in the browser build.

## Production setup

These examples use `/var/www/ssplwebsite`, Nginx, systemd, and Node.js 22.12+ (Node 24 recommended) at `/usr/bin/node`. Adjust the paths and service user if your server differs. The backend uses only Node built-ins, so `npm install` and a production build are not needed on the VM.

1. Pull the current branch in `/var/www/ssplwebsite`.
2. Create `/etc/chettiyar-website.env` with your exact public origin, including HTTPS and without a trailing slash:

   ```ini
   APP_ORIGIN=https://your-actual-website-domain
   ```

3. Copy `deploy/chettiyar-website.service` to `/etc/systemd/system/chettiyar-website.service`. Ensure the service user can read the repository. Then run:

   ```sh
   sudo systemctl daemon-reload
   sudo systemctl enable --now chettiyar-website
   sudo systemctl status chettiyar-website
   ```

4. Use `deploy/nginx-location.conf` in your existing HTTPS website server block, replacing the static `location /`. Remove any conflicting static locations for photo paths or the API. Keep your TLS configuration and redirect HTTP visitors to HTTPS. Validate and reload:

   ```sh
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. Open `/login`, sign in, and upload a shop photo. Refresh the public site in another browser to verify the saved change is visible. The toolbar provides shops/items, gallery, and sign-out links.

The server binds to loopback port 3000. `APP_ORIGIN` checks prevent cross-site writes. HTTPS sessions use Secure, HttpOnly, SameSite cookies, expire after eight hours, and are invalidated by logout or a server restart. Failed sign-ins are rate limited. Implementation uses [Node crypto](https://nodejs.org/api/crypto.html) for password verification and session tokens.

## Persistent content and updates

Production and development photos now have independent storage:

- Development uploads stay in the repository's `public/` folder with metadata in `src/shops.json` and `src/gallery.json`. Build, commit and push to publish them. The production website reads this set after each Git update.
- Production uploads stay in `/var/lib/chettiyar-website/public/` and are served under `/production-media/`. Its `src/shops.json` and `src/gallery.json` describe only production uploads. Git updates do not overwrite this set.
- The website combines both sets. Each shop displays both photos when available; gallery sections include photos from both sources. Uploading replaces only that environment's shop photo. Gallery deletion and renaming affect only the current environment's photos; imported photos have no editing controls.
- The brand uses the production logo when present, otherwise the development logo.
- **Our Items uses only `/var/lib/chettiyar-website/src/items.json`.** New production installs start with an empty list, never seeded from repository items. Existing production items are preserved. Manage items while signed in on the production website; development item writes are rejected.

On upgrade from the previous seeded-storage implementation, the server creates `migration-backup/` inside the data directory. It removes only copied photo metadata that still matches the development metadata and file contents exactly. Distinct production uploads and all existing production items are retained, and original image files are left in place. This migration runs once. If an old copy cannot be confidently identified, it is retained as production content.

Back up the entire data directory. Production edits take effect immediately without rebuilding or pushing Git. The public `/api/content` response supplies merged photos and production items; the browser never falls back to bundled development items if this API is unavailable.

Future code updates:

```sh
cd /var/www/ssplwebsite
git pull --ff-only origin main
sudo systemctl restart chettiyar-website
```

## Development preview

Run `npm run dev`, visit `/login`, and sign in. Photo editing saves to repository `src/` and `public/` files for building and committing.

The development server reads production content from **https://www.chettiyarkada.in/api/content**. It combines current local photos with production uploads and displays the production items read-only. To preview another production server:

```sh
PRODUCTION_ORIGIN=https://another-production-host npm run dev
```

`PRODUCTION_ORIGIN` must point to the Node production backend, not a Vite development server. If production is unavailable, local photos remain visible and Our Items shows an unavailable message; development items are never substituted. No production login credentials or cookies are sent for this public read.

To test the production backend locally with isolated persistent storage:

```sh
APP_ORIGIN=http://localhost:3000 npm start
```

Open `http://localhost:3000/login`. Local data defaults to the Git-ignored `data/` folder. Set `DATA_DIR` to use another directory. Set `APP_ORIGIN` when accessing development behind an HTTPS proxy as well.

Run `npm test` for integration coverage of authentication, separate photo sources, gallery/item edits, migration, production-only items, sessions, and persistence.
