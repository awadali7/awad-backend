# Deploying awad-backend alongside elearning-backend

Written for `srv1171172`, which already runs `elearning-backend` under PM2.
Nothing here modifies that app: separate port, separate database, separate
nginx server block, separate PM2 entry.

Confirmed on that box before writing this:

| Requirement | Server has | Status |
| --- | --- | --- |
| Node `^20.19 \|\| ^22.12 \|\| >=24` | v20.19.6 | OK — see the warning below |
| PostgreSQL | 16.15, on 127.0.0.1:5432 | OK |
| nginx | 1.24.0 | OK |
| PM2 | running, 1 app | OK |
| Port 3001 | not bound | free |
| RAM | 7.3 GB available | app uses ~130 MB |

> **Node version warning.** v20.19.6 clears the floor by a single patch
> release: Prisma 7 rejects anything below 20.19, and rejects Node 21 and 23
> outright. Do not let an unattended upgrade move Node until you have checked
> the new version against `engines` in `package.json`.

---

## 1. Database

Postgres is already running and is shared with the e-learning app. Give this
app its own role and its own database — never the same database.

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE awad_backend WITH LOGIN PASSWORD 'GENERATE_A_STRONG_ONE';
CREATE DATABASE awad_backend OWNER awad_backend;
\q
```

`OWNER` is load-bearing. Since PostgreSQL 15, a non-owner role cannot create
tables in the `public` schema, and `prisma migrate deploy` fails with
`permission denied for schema public`. Making the role the database owner
avoids that without granting anything server-wide.

## 2. Code and build

```bash
sudo mkdir -p /var/www/awad-backend && cd /var/www/awad-backend
# clone or rsync the repo here, then:
npm ci
npm run build
```

## 3. Environment

Create `/var/www/awad-backend/.env` (gitignored; the app loads it via
`@nestjs/config`). Generate each secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```ini
NODE_ENV=production
HOST=127.0.0.1          # keeps port 3001 off the public internet
PORT=3001

DATABASE_URL="postgresql://awad_backend:THE_DB_PASSWORD@127.0.0.1:5432/awad_backend"

API_KEY="<random>"
JWT_SECRET="<random>"
ADMIN_JWT_SECRET="<random, different from JWT_SECRET>"
ADMIN_JWT_EXPIRES_IN="12h"

CORS_ORIGIN="https://awadali.com,https://www.awadali.com"

RAZORPAY_KEY_ID="..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."

# Read once by the seed below, then never again.
ADMIN_USERNAME="awadali"
ADMIN_PASSWORD="<pick something stronger than the dev password>"
```

The app refuses to start if any of these are missing, naming all of them in one
error — a missing value cannot slip through to a 500 at request time.

```bash
chmod 600 .env
```

## 4. Migrate and seed

```bash
npm run prisma:deploy    # applies all 3 migrations
npm run prisma:seed      # FIRST DEPLOY ONLY
```

The seed only ever *creates*. Re-running it prints `Skipping admin seed` and
leaves an existing password alone, so a later deploy cannot reset a password you
changed through the console. (Verified: re-seeding with a different
`ADMIN_PASSWORD` left the original password working and the new one rejected.)

Once seeded, delete `ADMIN_PASSWORD` from `.env`.

## 5. PM2

```bash
cd /var/www/awad-backend
pm2 start ecosystem.config.js    # ADDS to the list; elearning-backend is untouched
pm2 list                         # expect both apps online
pm2 save                         # snapshots BOTH apps for reboot
```

`pm2 save` persists whatever is running right now, so confirm
`elearning-backend` is online before running it. If `pm2 startup` was never
configured, run it once and follow the command it prints.

`ecosystem.config.js` pins a single instance deliberately: the login rate
limiter counts attempts in-process, so a second instance would double the
5-per-minute limit.

## 6. nginx

```bash
sudo cp deploy/nginx-api.conf /etc/nginx/sites-available/awad-backend
sudo ln -s /etc/nginx/sites-available/awad-backend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.awadali.com
```

Point the `api` DNS record at the server before running certbot. The existing
site's server block is matched by its own `server_name` and is unaffected.

## 7. Vercel (the portfolio)

The `/admin` console calls this API **server-side** from Next API routes, so no
browser ever talks to it directly and CORS is irrelevant to the console.

Set in the Vercel project:

```
BACKEND_API_URL=https://api.awadali.com
BACKEND_API_KEY=<the same API_KEY from .env>
```

Then redeploy. `CORS_ORIGIN` on the backend matters only for the Bullseye
storefront, which does call from the browser.

## 8. Verify

```bash
curl -s https://api.awadali.com/                 # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' \
     https://api.awadali.com/bills               # 401 — guarded
curl -s -o /dev/null -w '%{http_code}\n' \
     https://api.awadali.com/docs                # 404 — Swagger off in production
curl -s -o /dev/null -w '%{http_code}\n' \
     http://SERVER_IP:3001/                      # must fail — not publicly bound
pm2 list                                         # both apps online
```

Then sign in at `https://awadali.com/admin`.

## Rollback

```bash
pm2 stop awad-backend && pm2 delete awad-backend && pm2 save
sudo rm /etc/nginx/sites-enabled/awad-backend && sudo systemctl reload nginx
```

The e-learning app and its database are untouched by any of this.
