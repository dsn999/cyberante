# Deploy CYBERANTE at holactie.com/cyberante/

Target: Ubuntu 24.04 Droplet, public IPv4 `143.198.161.195`.
These are setup instructions, not a record of completed deployment.

## 1. GoDaddy DNS

Open Domain Portfolio → holactie.com → DNS. Edit the parked A record named
`@` to `143.198.161.195`, keeping the default TTL. Preserve nameservers and
email records. If an AAAA record points to another server, remove that stale
record or update it to this Droplet's IPv6 address. Disable domain forwarding
if configured. DNS changes can take up to 48 hours globally.

Reference: [GoDaddy A records](https://www.godaddy.com/help/edit-an-a-record-19239).

## 2. Upload this release from your local WSL terminal

Run from the CyberAnte repository after its deployment changes are committed:

```bash
git archive --format=tar.gz --output=/tmp/cyberante-deploy.tar.gz HEAD
scp /tmp/cyberante-deploy.tar.gz root@143.198.161.195:/tmp/cyberante-deploy.tar.gz
ssh root@143.198.161.195
```

The SSH key used when creating the Droplet must be available to your SSH client.
This archive uses the local committed release; a GitHub push is not required.

## 3. On the Droplet

Run in the SSH session, assuming a fresh Ubuntu 24.04 server:

```bash
apt update
apt install -y docker.io docker-compose-v2
systemctl enable --now docker
mkdir -p /opt/cyberante
tar -xzf /tmp/cyberante-deploy.tar.gz -C /opt/cyberante
cd /opt/cyberante
docker compose -f deploy/holactie/compose.yaml up -d --build
docker compose -f deploy/holactie/compose.yaml ps
```

Ubuntu supplies the [Compose v2 package](https://packages.ubuntu.com/noble/docker-compose-v2).
Alternatively use [Docker's official Ubuntu repository](https://docs.docker.com/engine/install/ubuntu/).
Do not combine installations from both repositories.

The game image builds with Node 24, checks the bundle and runs as the unprivileged
`node` user. Only Caddy publishes ports; game port 8080 stays inside the Docker
network. Docker and the containers start after reboot. The restart policy
restarts exited containers; the healthcheck reports readiness but does not
itself restart an unhealthy, still-running process.

Allow inbound TCP 80 and 443 in any DigitalOcean Cloud Firewall, and TCP 22
from your own IP for SSH. If a host firewall is active, allow the same traffic.
Do not publish 8080. No GPU or database is needed on the server: browsers draw
the graphics locally.

## 4. Check the public game

After DNS points here and Caddy obtains its certificate, open:

**https://holactie.com/cyberante/**

Useful commands on the server:

```bash
docker compose -f deploy/holactie/compose.yaml logs --tail=100 caddy game
curl -fsS https://holactie.com/cyberante/health
```

Health should report `{"status":"ok","rooms":0}` when no rooms are active.
Host a room in one browser/device and join from another using its invitation
link. Play a match and check brief disconnect recovery. Record the release
commit and results in the QA release acceptance record once verified externally.
Deployment alone does not prove physical-device FPS acceptance.

If HTTPS fails, check the A/AAAA answers and inbound 80/443, then the Caddy
logs. Caddy automatically obtains and renews certificates; preserve its
`caddy_data` volume. [Caddy HTTPS requirements](https://caddyserver.com/docs/quick-starts/https).

## How the path works

The image uses `CYBERANTE_BASE_PATH=/cyberante/` at build time. Vite emits assets
under that URL prefix and the browser connects to `/cyberante/ws`. Caddy's
`handle_path` strips `/cyberante` before forwarding HTTP and WebSocket requests
to the unchanged Node routes. Room invitations use the current page path.
`/cyberante` redirects to `/cyberante/`; the root domain displays `Holactie`.

Normal local builds default to `/` and `/ws` as before. To change the hosted
path, update both the Compose build argument and Caddy matcher/redirect, then
rebuild the image. Images use major-version tags; record deployed image digests
when collecting final release evidence.

## Updates

Upload a new committed archive and extract it into a fresh release directory,
then deliberately replace the application files. Avoid overlaying an archive
on an old tree, which can retain removed files. Rebuild using the same Compose
project name and preserve the Caddy volumes. Schedule updates between matches:
rooms and reconnect credentials are in memory, and server replacement ends them.

Never run `docker compose down -v` during routine updates: it deletes the
persistent certificate volumes.
