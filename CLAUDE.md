# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Flappy Bird clone built with vanilla HTML, CSS, and JavaScript. No build system, bundler, or package manager is used.

## Development

Open `index.html` directly in a browser or use any static file server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

## Architecture

**Single-file game logic** ([script.js](script.js)):
- Game state machine with three states: `START`, `PLAYING`, `GAMEOVER`
- Game objects (`bird`, `pipes`, `background`) are singletons with `draw()`, `update()`, and `reset()` methods
- `Particle` class handles blood splatter effects on collision
- Web Audio API generates jump sounds procedurally via oscillator
- High score persisted to localStorage under key `flappy_best_score`
- Canvas-based rendering with `requestAnimationFrame` game loop

**UI layers** ([index.html](index.html)):
- Canvas for game rendering
- Overlay divs for start screen, game over screen, and score display
- Visibility toggled via `.hidden` CSS class

## Deployment

Static files can be deployed directly to GitHub Pages (see README for steps).
