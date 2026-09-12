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

On first start, the server seeds `/var/lib/chettiyar-website` from the committed `public/` images and `src/shops.json`, `src/gallery.json`, `src/items.json`, and `src/logo.json`. Later starts preserve that directory. Back it up: it contains the live photos and content. Live edits take effect immediately without rebuilding or pushing Git and are not automatically copied back to the repository.

Future code updates:

```sh
cd /var/www/ssplwebsite
git pull --ff-only origin main
sudo systemctl restart chettiyar-website
```

Repository photo/metadata updates do not overwrite existing live data. To transfer live content back to the repository, deliberately copy the data directory's `src/*.json` and `public/` files into the matching repository paths, then build, commit and push.

## Development

Run `npm run dev`, visit `/login`, and sign in with the same account. Editing now requires login in development too. Development changes still save to repository `src/` and `public/` files for building and committing.

To test the production backend locally with isolated persistent storage:

```sh
APP_ORIGIN=http://localhost:3000 npm start
```

Open `http://localhost:3000/login`. Local data defaults to the Git-ignored `data/` folder. Set `DATA_DIR` to use another directory. Set `APP_ORIGIN` when accessing development behind an HTTPS proxy as well.

Run `npm test` for integration coverage of authentication, uploads, gallery/item edits, sessions, and persistence.
