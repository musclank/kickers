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


## Online multiplayer (first implementation)

The browser client supports room creation/joining and real-time player position/rotation updates for up to four players. The separate Cloudflare Worker in `worker/index.js` uses a Durable Object per room.

### Deploy the multiplayer Worker

1. In Cloudflare, open **Workers & Pages** and choose **Create application**.
2. Choose the GitHub import option and connect `musclank/kickers`.
3. The Worker name must be `kickers-multiplayer`, matching `wrangler.toml`.
4. Use the repository root as the root directory. Leave the build command empty and use `npx wrangler deploy` as the deploy command.
5. Deploy, then copy the resulting `https://kickers-multiplayer.<account>.workers.dev` URL.
6. Open KICKERS, choose **PLAY ONLINE**, paste the Worker URL, then create or join a six-character room code.

Alternatively, deploy from a computer with `npx wrangler login` followed by `npx wrangler deploy` from the repository root.

Cloudflare Pages continues to host the game frontend. The Worker is a separate service. The first multiplayer phase synchronizes player presence, movement, direction, and kick animation; authoritative hit detection, matchmaking, and persistence are subsequent phases.
