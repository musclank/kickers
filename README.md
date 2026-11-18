# KICKERS

A free-first browser prototype for a cartoon arena brawler. Move around the arena, approach rivals, and kick them out. The current build is a visual movement prototype; combat physics, round logic, bots, and online play are planned next.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Stack

- Three.js for the 3D scene
- TypeScript
- Vite
- Cloudflare Pages for free-tier static hosting

## Controls

- Desktop: WASD / arrow keys to move, Space to kick
- Mobile: left virtual joystick to move, KICK button to kick

## Roadmap

1. Arena and mobile movement prototype
2. Kick hit detection, knockback, and elimination
3. Match flow, winner screen, and restart
4. Local bots and improved character animation
5. Online multiplayer
6. Optional Base Sepolia wallet/cosmetic experiments

Blockchain integration is optional and does not require a token. Online services may have usage limits or costs as the game scales.
