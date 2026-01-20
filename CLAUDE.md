# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static PWA (Progressive Web App) that displays tide information for João Pessoa, Paraíba, Brazil. The app shows daily tide times and heights with a Chart.js visualization, current tide estimate, and countdown to the next tide.

## Architecture

**Static site with no build step** - Files are served directly:
- `index.html` - Single page with date picker, chart canvas, and tide list
- `app.js` - All application logic (data loading, chart rendering, time calculations)
- `styles.css` - Responsive styling
- `tides.json` - Tide data with datetime and height values
- `sw.js` - Service worker for offline caching (cache version: `mare-jp-v4`)
- `site.webmanifest` - PWA manifest

**Key patterns in app.js:**
- All times use `America/Recife` timezone (UTC-3)
- Tide heights >= 1.5m are considered "high tide"
- Cosine interpolation for smooth tide curves: `h1 + (h2 - h1) * 0.5 * (1 - Math.cos(Math.PI * pct))`
- Chart.js custom plugin draws "Agora" (Now) vertical line on today's view

## Development

No build tools required. Serve files with any static server:

```bash
# Python
python -m http.server 8000

# Node
npx serve .

# PHP
php -S localhost:8000
```

## Data Format

`tides.json` contains an array of tide events:
```json
{"datetime": "2026-01-18T14:30:00", "height": 2.1}
```
- `datetime`: ISO format in João Pessoa local time (not UTC)
- `height`: Tide height in meters

## Service Worker

When modifying cached assets, increment `CACHE_NAME` version in `sw.js` (currently `mare-jp-v4`).

## Language

UI text and comments are in Portuguese (Brazilian).
