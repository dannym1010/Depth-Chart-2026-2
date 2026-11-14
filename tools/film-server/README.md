# Mahopac film server

Streams the team film folder on an external drive to the app on any device: iPad, phone, another computer.
It works like Google Drive: each clip plays as it streams, nothing is copied first. You can jump anywhere in a clip.

It runs on the computer the drive is plugged into. Tailscale (free) gives it a secure https address that only your
own devices can reach, at home or away. The iPad needs Tailscale too.

## One-time setup (Windows PC with the drive)

1. **Node.js**: install the LTS version from https://nodejs.org (if `node --version` in Command Prompt says nothing).
2. **Tailscale**: install from https://tailscale.com/download and sign in. Install the **Tailscale** app on the iPad
   and sign in with the same account. In the Tailscale admin page (https://login.tailscale.com/admin/dns) turn on
   **MagicDNS** and **HTTPS Certificates**.
3. **Copy this folder** (`tools/film-server`) to the PC, for example `C:\FilmServer`.

## Start it

In Command Prompt:

```
cd C:\FilmServer
node film-server.mjs "E:\Mahopac Film"
```

Use your film folder's real path: the one with the team folders (like `10U`) in it. The window shows the **key**.
Leave the window open while you want film.

In a second Command Prompt (once; it keeps working after restarts):

```
tailscale serve --bg 8787
```

It shows an address like `https://your-pc.your-tailnet.ts.net`.

## In the app (each device, once)

Film Room → a game → **Link film** → **Team film server** → **Set up**: paste the https address and the key →
**Connect**. Every game looks there first; its clips stream. Highlights has the same setup in its film bar.

Highlights → a reel → **Export** (for DaVinci Resolve, on the computer the film server runs on) fills in the film
folder's real path from the film server, so nothing has to be typed. That needs this version of `film-server.mjs`:
copy it over the old one and start the film server again.

## Local mode: this network only (no internet, no Tailscale)

The app only takes film from an **https** address. In local mode the film server gives itself a certificate for
your network, and the iPad trusts it once.

1. Install **Git for Windows** if you don't have it (it brings OpenSSL): https://git-scm.com
2. In the film server folder: `node make-cert.mjs`. It makes `cert\` with the certificates for this computer's
   network address. Run it again if the computer's address changes. Give the PC a fixed address in your router
   ("DHCP reservation") so that rarely happens.
3. Start the film server as usual: `node film-server.mjs "E:\Mahopac Film"`. It now says **local mode**, with the
   address for the app (like `https://192.168.1.25:8787`) and a page for the iPad.
4. **On the iPad, once:** in Safari open the page it shows (like `http://192.168.1.25:8788`):
   - **Download the certificate** → Allow → **Settings → Profile Downloaded → Install**
   - **Settings → General → About → Certificate Trust Settings** → turn on **Mahopac Film Server**
5. In the app: Link film → Team film server → Set up → the https address and the key → Connect.

Windows may ask to let Node through the firewall the first time: allow it on **Private** networks.

For a portable NAS in its own Wi-Fi (AP) mode: run `node make-cert.mjs <its address>` on the machine that runs the
film server there.

## Start it with the computer (optional)

Make `start-film-server.cmd` next to `film-server.mjs`:

```
@echo off
cd /d C:\FilmServer
node film-server.mjs "E:\Mahopac Film"
```

Then press Win+R, type `shell:startup`, and put a shortcut to it in that folder.

## Notes

- The computer has to be on, with the drive plugged in and the film server running.
- Away from home, film streams up from your home internet: its upload speed is the limit.
- A portable NAS works only if it can run this (Node) and Tailscale. A small computer such as a Raspberry Pi with
  the drive plugged in can. A plain network drive (SMB) can't be streamed to Safari.
- Read only: the film server never changes or deletes anything on the drive.
