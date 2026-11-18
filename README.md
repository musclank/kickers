# KICKERS

A free-first browser prototype for a cartoon arena brawler. Move around the arena, customize a fighter, approach rivals, and kick them out.

## Character Creator

The live 3D character creator lets players customize:
- Skin, outfit, shoe, and hair colors
- Hair styles and accessories
- Body width, body height, head size, and leg length
- Save a character design locally in the current browser

Character designs are currently stored on the player's device, not in an online account.

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
2. Character creator and local character saving
3. Kick hit detection, knockback, and elimination
4. Match flow, winner screen, and restart
5. Local bots and improved character animation
6. Online multiplayer
7. Optional Base Sepolia wallet/cosmetic experiments

Blockchain integration is optional and does not require a token. Online services may have usage limits or costs as the game scales.
