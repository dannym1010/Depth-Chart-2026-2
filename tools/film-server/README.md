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
