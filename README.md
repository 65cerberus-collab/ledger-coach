# Ledger — Coach

A coach-centric personal training web app, optimized for iPad use.

## Features

- Multi-coach support with isolated client lists
- Client profiles (goals, injuries, equipment, level)
- Shared exercise library (~180 exercises across all modalities)
- Workout builder with rule-based filtering
- Program templates for reuse across clients
- Session scheduling with calendar view
- Coach and client logging (with source tracking)
- Attendance tracking (present / missed / cancelled)
- Progress tracking (PRs, bodyweight, notes)
- Client view with simplified mobile interface
- JSON backup/restore
- PWA — installable to home screen on any tablet

## Deployment

This project is set up for deployment to Vercel:

1. Push to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Vite; accept defaults and deploy

## Tech Stack

- React 18
- Vite
- Tailwind CSS (via CDN)
- lucide-react icons
- vite-plugin-pwa for Progressive Web App support
- localStorage for persistence (via storage shim)

## Data

All data lives in browser localStorage (per-device, per-browser). Use
the Backup / Restore feature in the coach menu to move data between devices.

## License

Private project. Not for redistribution.
