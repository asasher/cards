# Cards Dev Setup

## Local Gateway Development

Development uses a stable browser URL while app/DB ports stay random:

- App URL: `http://app.cards.localhost:7600`
- App process: random port tracked in `.dev-app-port`
- Postgres host port: random mapping tracked in `.dev-db-port`

### Normal startup

```bash
bun run dev
```

This flow runs, in order:

1. `gateway:up` to start/reuse `cards-dev-gateway` (Caddy reverse proxy)
2. `db:up` to start Postgres with random mapped host port and update `.env`
3. `db:migrate`
4. web `dev`

### Useful commands

```bash
bun run gateway:up
bun run db:up
bun run db:logs
bun run dev:with-logs
```

### Overrides

- `DEV_APP_HOST` (default: `app.cards.localhost`)
- `DEV_GATEWAY_PORT` (default: `7600`)
- `DEV_GATEWAY_CONTAINER` (default: `cards-dev-gateway`)
- `COMPOSE_PROJECT_NAME` (default: `cards-dev`)
- `DEV_APP_PORT` (optional fixed app port; otherwise random/free)
