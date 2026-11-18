import * as THREE from 'three';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const statusEl = document.querySelector<HTMLSpanElement>('#status')!;
const kickButton = document.querySelector<HTMLButtonElement>('#kick')!;
const joystick = document.querySelector<HTMLDivElement>('#joystick')!;
const stick = document.querySelector<HTMLDivElement>('#stick')!;
const creator = document.querySelector<HTMLDivElement>('#creator')!;
const creatorToggle = document.querySelector<HTMLButtonElement>('#creator-toggle')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save-character')!;
const savedLabel = document.querySelector<HTMLSpanElement>('#saved-label')!;
const fullscreenButton = document.querySelector<HTMLButtonElement>('#fullscreen-toggle')!;

type AvatarConfig = {
  skin: string; outfit: string; shoes: string; hairColor: string; hairStyle: string; accessory: string;
  bodyWidth: number; bodyHeight: number; headSize: number; legLength: number; shirtImage?: string;
};
const defaults: AvatarConfig = {
  skin: '#4de2d0', outfit: '#ffb84d', shoes: '#24243a', hairColor: '#26314d', hairStyle: 'smooth',
  accessory: 'none', bodyWidth: 1, bodyHeight: 1, headSize: 1, legLength: 1
};
let config: AvatarConfig = { ...defaults };
let shirtTexture: THREE.Texture | null = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10152b);
scene.fog = new THREE.Fog(0x10152b, 24, 58);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 14, 20);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);
renderer.domElement.className = 'game-canvas';

scene.add(new THREE.HemisphereLight(0xb8d7ff, 0x24203b, 2));
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(-5, 12, 7); sun.castShadow = true; scene.add(sun);
const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.7, 64), new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.85 }));
floor.position.y = -0.45; floor.receiveShadow = true; scene.add(floor);
const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.22, 12, 80), new THREE.MeshStandardMaterial({ color: 0xffc857, metalness: 0.35, roughness: 0.45 }));
rim.rotation.x = Math.PI / 2; rim.position.y = -0.05; scene.add(rim);
// Grid removed for a clean white arena floor.

// Base logo floor decal: a solid blue raised tile guarantees visibility,
// while the official white Basemark SVG supplies the brand symbol.
const baseTile = new THREE.Mesh(
  new THREE.BoxGeometry(3.9, 0.035, 3.9),
  new THREE.MeshBasicMaterial({ color: 0x0052ff })
);
baseTile.position.set(0, -0.065, 0);
baseTile.renderOrder = 20;
scene.add(baseTile);

const baseTextureLoader = new THREE.TextureLoader();
baseTextureLoader.load(
  '/base-basemark-white.svg',
  (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 0.945),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(0, -0.045, 0);
    mark.renderOrder = 21;
    scene.add(mark);
  },
  undefined,
  (error) => console.error('Base floor mark failed to load:', error)
);

function material(color: string) { return new THREE.MeshStandardMaterial({ color, roughness: 0.68 }); }
function addMesh(parent: THREE.Group, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function makeAvatar(cfg: AvatarConfig, x: number, z: number, useShirtTexture = true) {
  const group = new THREE.Group();
  const bodyY = 0.85 * cfg.bodyHeight;
  addMesh(group, new THREE.CapsuleGeometry(0.48 * cfg.bodyWidth, 0.55 * cfg.bodyHeight, 6, 12), cfg.outfit, 0, bodyY, 0);
  addMesh(group, new THREE.SphereGeometry(0.39 * cfg.headSize, 20, 16), cfg.skin, 0, bodyY + 0.82 * cfg.headSize, 0);
  if (shirtTexture && useShirtTexture) {
    // Curved UV patches follow the capsule torso instead of floating as flat planes.
    const makeShirtPatch = (back: boolean) => {
      const columns = 24, rows = 28;
      const radius = 0.48 * cfg.bodyWidth;
      const halfCylinder = 0.275 * cfg.bodyHeight;
      const patchWidth = radius * 1.42;
      const patchHeight = 0.68 * cfg.bodyHeight;
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let row = 0; row <= rows; row++) {
        const v = row / rows;
        const y = (0.5 - v) * patchHeight;
        const capOffset = Math.max(0, Math.abs(y) - halfCylinder);
        const sectionRadius = Math.sqrt(Math.max(0.001, radius * radius - capOffset * capOffset));
        for (let column = 0; column <= columns; column++) {
          const u = column / columns;
          const localU = back ? 1 - u : u;
          const x = (localU - 0.5) * patchWidth;
          const surfaceZ = Math.sqrt(Math.max(0.001, sectionRadius * sectionRadius - x * x));
          positions.push(x, bodyY + y, (back ? 1 : -1) * (surfaceZ + 0.008));
          uvs.push(u, 1 - v);
        }
      }
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const a = row * (columns + 1) + column;
          const b = a + columns + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const print = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        map: shirtTexture!, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -1
      }));
      print.renderOrder = 4;
      group.add(print);
    };
    makeShirtPatch(false);
    makeShirtPatch(true);
  }
  // Eyes and smile sit on the front (-Z).
  addMesh(group, new THREE.SphereGeometry(0.055, 12, 10), '#172033', -0.14 * cfg.headSize, bodyY + 0.9 * cfg.headSize, -0.34 * cfg.headSize);
  addMesh(group, new THREE.SphereGeometry(0.055, 12, 10), '#172033', 0.14 * cfg.headSize, bodyY + 0.9 * cfg.headSize, -0.34 * cfg.headSize);
  const smile = addMesh(group, new THREE.TorusGeometry(0.09 * cfg.headSize, 0.018, 6, 16, Math.PI), '#172033', 0, bodyY + 0.72 * cfg.headSize, -0.355 * cfg.headSize);
  smile.rotation.z = Math.PI;
  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.13, 0.42, 4, 8);
  const leftArm = addMesh(group, armGeo, cfg.skin, -0.58 * cfg.bodyWidth, bodyY + 0.03, 0);
  const rightArm = addMesh(group, armGeo, cfg.skin, 0.58 * cfg.bodyWidth, bodyY + 0.03, 0);
  leftArm.rotation.z = -0.25; rightArm.rotation.z = 0.25;
  // Separate articulated legs: the right leg is the actual kicking leg.
  const legScale = cfg.legLength;
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.22 * cfg.bodyWidth, 0.34 * legScale, 0);
  addMesh(leftLeg, new THREE.CapsuleGeometry(0.15, 0.28 * legScale, 4, 8), cfg.skin, 0, -0.16 * legScale, 0);
  addMesh(leftLeg, new THREE.BoxGeometry(0.34, 0.2, 0.5), cfg.shoes, 0, -0.34 * legScale, -0.13);
  group.add(leftLeg);

  const kickLeg = new THREE.Group();
  kickLeg.position.set(0.22 * cfg.bodyWidth, 0.34 * legScale, 0);
  addMesh(kickLeg, new THREE.CapsuleGeometry(0.15, 0.28 * legScale, 4, 8), cfg.skin, 0, -0.16 * legScale, 0);
  const knee = addMesh(kickLeg, new THREE.SphereGeometry(0.15, 12, 10), cfg.skin, 0, -0.29 * legScale, 0);
  const shin = new THREE.Group();
  shin.position.set(0, -0.29 * legScale, 0);
  addMesh(shin, new THREE.CapsuleGeometry(0.13, 0.25 * legScale, 4, 8), cfg.skin, 0, -0.13 * legScale, 0);
  addMesh(shin, new THREE.BoxGeometry(0.36, 0.2, 0.54), cfg.shoes, 0, -0.29 * legScale, -0.16);
  kickLeg.add(shin);
  group.add(kickLeg);
  group.userData.leftLeg = leftLeg;
  group.userData.kickLeg = kickLeg;
  group.userData.kickShin = shin;
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  // Hair options
  if (cfg.hairStyle !== 'none') {
    if (cfg.hairStyle === 'spiky') {
      for (let i = -1; i <= 1; i++) {
        const tuft = addMesh(group, new THREE.ConeGeometry(0.14, 0.34, 8), cfg.hairColor, i * 0.2, bodyY + 1.2 * cfg.headSize, 0);
        tuft.rotation.z = i * -0.35;
      }
    } else if (cfg.hairStyle === 'cap') {
      addMesh(group, new THREE.SphereGeometry(0.41 * cfg.headSize, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), cfg.hairColor, 0, bodyY + 1.03 * cfg.headSize, 0);
      addMesh(group, new THREE.BoxGeometry(0.48, 0.06, 0.28), cfg.hairColor, 0, bodyY + 0.99 * cfg.headSize, -0.28);
    } else {
      addMesh(group, new THREE.SphereGeometry(0.4 * cfg.headSize, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), cfg.hairColor, 0, bodyY + 1.08 * cfg.headSize, 0);
    }
  }
  // Accessories
  if (cfg.accessory === 'glasses') {
    for (const side of [-1, 1]) {
      const lens = addMesh(group, new THREE.TorusGeometry(0.105 * cfg.headSize, 0.025, 8, 20), '#1b2439', side * 0.14 * cfg.headSize, bodyY + 0.9 * cfg.headSize, -0.36 * cfg.headSize);
      lens.scale.set(1, 0.8, 1);
    }
    addMesh(group, new THREE.BoxGeometry(0.16, 0.025, 0.025), '#1b2439', 0, bodyY + 0.9 * cfg.headSize, -0.36 * cfg.headSize);
  } else if (cfg.accessory === 'crown') {
    addMesh(group, new THREE.ConeGeometry(0.32, 0.3, 5), '#ffd34e', 0, bodyY + 1.36 * cfg.headSize, 0);
  } else if (cfg.accessory === 'horns') {
    for (const side of [-1, 1]) {
      const horn = addMesh(group, new THREE.ConeGeometry(0.12, 0.38, 8), '#f5f1e8', side * 0.28, bodyY + 1.28 * cfg.headSize, 0);
      horn.rotation.z = side * -0.35;
    }
  }
  group.position.set(x, 0, z); scene.add(group); return group;
}
let player = makeAvatar(config, 0, 2);
const rivals = [
  makeAvatar({ ...defaults, skin: '#ff6b78', outfit: '#5d293d', accessory: 'horns' }, -4, -2),
  makeAvatar({ ...defaults, skin: '#ffc857', outfit: '#4b5f9a', hairStyle: 'spiky' }, 4, -3),
  makeAvatar({ ...defaults, skin: '#9b83ff', outfit: '#3d725f', accessory: 'crown' }, 1, -6)
];

type RemotePlayer = { mesh: THREE.Group; targetX: number; targetZ: number; targetRotation: number; };
const remotePlayers = new Map<string, RemotePlayer>();
const onlinePanel = document.querySelector<HTMLDivElement>('#online-panel')!;
const onlineToggle = document.querySelector<HTMLButtonElement>('#online-toggle')!;
const workerUrlInput = document.querySelector<HTMLInputElement>('#worker-url')!;
const roomCodeInput = document.querySelector<HTMLInputElement>('#room-code')!;
const createRoomButton = document.querySelector<HTMLButtonElement>('#create-room')!;
const joinRoomButton = document.querySelector<HTMLButtonElement>('#join-room')!;
const leaveRoomButton = document.querySelector<HTMLButtonElement>('#leave-room')!;
const onlineMessage = document.querySelector<HTMLSpanElement>('#online-message')!;
const roomDisplay = document.querySelector<HTMLDivElement>('#room-display')!;
const roomCodeText = document.querySelector<HTMLElement>('#room-code-value')!;
const playerCountText = document.querySelector<HTMLElement>('#player-count')!;
let socket: WebSocket | null = null;
let localPlayerId = localStorage.getItem('kickers-online-id') || crypto.randomUUID();
localStorage.setItem('kickers-online-id', localPlayerId);
let activeRoom = '';
let networkSendClock = 0;
let networkReady = false;
const savedWorkerUrl = localStorage.getItem('kickers-worker-url') || '';
workerUrlInput.value = savedWorkerUrl;
function setOnlineMessage(message: string) { onlineMessage.textContent = message; }
function getWorkerBase() {
  const value = workerUrlInput.value.trim().replace(/\/$/, '');
  if (!/^https:\/\//i.test(value)) throw new Error('Enter your HTTPS Worker URL first.');
  localStorage.setItem('kickers-worker-url', value);
  return value;
}
function updateRoster(players: Array<{ id: string; name?: string; avatar?: Partial<AvatarConfig>; x?: number; z?: number; rotation?: number }>) {
  const activeIds = new Set(players.filter(p => p.id !== localPlayerId).map(p => p.id));
  for (const [id, remote] of remotePlayers) {
    if (!activeIds.has(id)) {
      scene.remove(remote.mesh);
      remote.mesh.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      remotePlayers.delete(id);
    }
  }
  for (const item of players) {
    if (item.id === localPlayerId) continue;
    let remote = remotePlayers.get(item.id);
    if (!remote) {
      const look = { ...defaults, ...(item.avatar || {}) };
      const mesh = makeAvatar(look, item.x ?? 0, item.z ?? 0, false);
      remote = { mesh, targetX: item.x ?? 0, targetZ: item.z ?? 0, targetRotation: item.rotation ?? 0 };
      remotePlayers.set(item.id, remote);
    } else if (typeof item.x === 'number') {
      remote.targetX = item.x;
      remote.targetZ = item.z ?? remote.targetZ;
      remote.targetRotation = item.rotation ?? remote.targetRotation;
    }
  }
  playerCountText.textContent = `${players.length}/4 PLAYERS`;
}
function sendNetwork(payload: Record<string, unknown>) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}
function connectToRoom(room: string) {
  const base = getWorkerBase();
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = new URLSearchParams({ room, id: localPlayerId, name: 'KICKERS Player' }).toString();
  activeRoom = room;
  const ws = new WebSocket(url);
  socket = ws;
  setOnlineMessage('CONNECTING TO ROOM...');
  ws.addEventListener('open', () => {
    networkReady = true;
    sendNetwork({ type: 'hello', avatar: { ...config, shirtImage: undefined } });
    setOnlineMessage('CONNECTED — WAITING FOR PLAYERS');
    roomDisplay.hidden = false;
    roomCodeText.textContent = room;
    rivals.forEach(rival => { rival.visible = false; });
    statusEl.textContent = 'ONLINE';
    createRoomButton.disabled = true;
    joinRoomButton.disabled = true;
    leaveRoomButton.disabled = false;
  });
  ws.addEventListener('message', event => {
    try {
      const data = JSON.parse(String(event.data)) as { type: string; players?: Array<{ id: string; name?: string; avatar?: Partial<AvatarConfig>; x?: number; z?: number; rotation?: number }>; id?: string; x?: number; z?: number; rotation?: number };
      if (data.type === 'roster' && data.players) updateRoster(data.players);
      if (data.type === 'state' && data.id && data.id !== localPlayerId) {
        const remote = remotePlayers.get(data.id);
        if (remote && typeof data.x === 'number') {
          remote.targetX = data.x;
          remote.targetZ = data.z ?? remote.targetZ;
          remote.targetRotation = data.rotation ?? remote.targetRotation;
        }
      }
      if (data.type === 'kick' && data.id && data.id !== localPlayerId) {
        const remote = remotePlayers.get(data.id);
        if (remote) remote.mesh.userData.remoteKickTime = 0.48;
      }
    } catch (error) { console.warn('Invalid multiplayer message', error); }
  });
  ws.addEventListener('close', () => {
    if (socket !== ws) return;
    networkReady = false;
    socket = null;
    activeRoom = '';
    remotePlayers.forEach(remote => scene.remove(remote.mesh));
    remotePlayers.clear();
    rivals.forEach(rival => { rival.visible = true; });
    roomDisplay.hidden = true;
    createRoomButton.disabled = false;
    joinRoomButton.disabled = false;
    leaveRoomButton.disabled = true;
    playerCountText.textContent = '1/4 PLAYERS';
    statusEl.textContent = 'OFFLINE';
    setOnlineMessage('DISCONNECTED FROM ROOM');
  });
  ws.addEventListener('error', () => setOnlineMessage('CONNECTION ERROR — CHECK WORKER URL'));
}
async function createOnlineRoom() {
  try {
    const response = await fetch(`${getWorkerBase()}/api/rooms`, { method: 'POST' });
    if (!response.ok) throw new Error((await response.text()) || 'Could not create room.');
    const data = await response.json() as { room: string };
    roomCodeInput.value = data.room;
    connectToRoom(data.room);
  } catch (error) {
    setOnlineMessage(error instanceof Error ? error.message : 'ROOM CREATION FAILED');
  }
}
function joinOnlineRoom() {
  const room = roomCodeInput.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(room)) { setOnlineMessage('ENTER A 6-CHARACTER ROOM CODE'); return; }
  try { connectToRoom(room); }
  catch (error) { setOnlineMessage(error instanceof Error ? error.message : 'COULD NOT JOIN ROOM'); }
}
onlineToggle.addEventListener('click', () => onlinePanel.classList.toggle('open'));
createRoomButton.addEventListener('click', createOnlineRoom);
joinRoomButton.addEventListener('click', joinOnlineRoom);
leaveRoomButton.addEventListener('click', () => socket?.close(1000, 'Player left'));
\nfunction rebuildPlayer() {
  scene.remove(player);
  player.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); } });
  player = makeAvatar(config, player.position.x, player.position.z);
}
function bindColor(id: string, key: keyof AvatarConfig) {
  const input = document.querySelector<HTMLInputElement>('#' + id)!;
  input.value = String(config[key]);
  input.addEventListener('input', () => { (config[key] as string) = input.value; rebuildPlayer(); });
}
bindColor('skin-color', 'skin'); bindColor('outfit-color', 'outfit'); bindColor('shoe-color', 'shoes'); bindColor('hair-color', 'hairColor');

const shirtImageInput = document.querySelector<HTMLInputElement>('#shirt-image')!;
const removeShirtImageButton = document.querySelector<HTMLButtonElement>('#remove-shirt-image')!;
function applyShirtImage(dataUrl: string) {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) { savedLabel.textContent = 'IMAGE PROCESSING FAILED'; return; }
    // Center-crop the gallery image into a square shirt print.
    const size = Math.min(image.width, image.height);
    const sx = (image.width - size) / 2, sy = (image.height - size) / 2;
    context.clearRect(0, 0, 512, 512);
    context.drawImage(image, sx, sy, size, size, 0, 0, 512, 512);
    const textureCanvas = canvas;
    const nextTexture = new THREE.CanvasTexture(textureCanvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    const previousTexture = shirtTexture;
    shirtTexture = nextTexture;
    config.shirtImage = dataUrl;
    rebuildPlayer();
    previousTexture?.dispose();
    savedLabel.textContent = 'SHIRT PRINT APPLIED — SAVE TO KEEP IT';
  };
  image.onerror = () => { savedLabel.textContent = 'COULD NOT LOAD THAT IMAGE'; };
  image.src = dataUrl;
}
shirtImageInput.addEventListener('change', () => {
  const file = shirtImageInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { savedLabel.textContent = 'PLEASE CHOOSE AN IMAGE'; return; }
  if (file.size > 12 * 1024 * 1024) { savedLabel.textContent = 'IMAGE TOO LARGE — MAX 12 MB'; shirtImageInput.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string') return;
    // Resize the selected image while preserving alpha transparency for PNG/WebP shirt artwork.
    const source = new Image();
    source.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const size = Math.min(source.width, source.height);
      ctx.drawImage(source, (source.width - size) / 2, (source.height - size) / 2, size, size, 0, 0, 512, 512);
      // PNG keeps transparent pixels; JPEG would turn them into an opaque background.
      applyShirtImage(canvas.toDataURL('image/png'));
    };
    source.src = reader.result;
  };
  reader.readAsDataURL(file);
});
removeShirtImageButton.addEventListener('click', () => {
  const previousTexture = shirtTexture;
  shirtTexture = null; delete config.shirtImage;
  rebuildPlayer(); previousTexture?.dispose();
  shirtImageInput.value = '';
  savedLabel.textContent = 'SHIRT PRINT REMOVED — SAVE TO KEEP IT';
});
function bindSelect(id: string, key: keyof AvatarConfig) {
  const input = document.querySelector<HTMLSelectElement>('#' + id)!;
  input.value = String(config[key]);
  input.addEventListener('change', () => { (config[key] as string) = input.value; rebuildPlayer(); });
}
bindSelect('hair-style', 'hairStyle'); bindSelect('accessory', 'accessory');
function bindRange(id: string, key: keyof AvatarConfig) {
  const input = document.querySelector<HTMLInputElement>('#' + id)!;
  const output = document.querySelector<HTMLOutputElement>('#' + id + '-value')!;
  input.value = String(config[key]); output.value = Number(config[key]).toFixed(1);
  input.addEventListener('input', () => { (config[key] as number) = Number(input.value); output.value = Number(input.value).toFixed(1); rebuildPlayer(); });
}
bindRange('body-width', 'bodyWidth'); bindRange('body-height', 'bodyHeight'); bindRange('head-size', 'headSize'); bindRange('leg-length', 'legLength');

fullscreenButton.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await app.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    statusEl.textContent = 'FULLSCREEN UNAVAILABLE';
    console.warn('Fullscreen request failed:', error);
  }
});
document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = active ? 'EXIT FULL' : 'FULL SCREEN';
  fullscreenButton.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
});

creatorToggle.addEventListener('click', () => {
  creator.classList.toggle('open');
  creatorToggle.textContent = creator.classList.contains('open') ? 'CLOSE CREATOR' : 'CUSTOMIZE';
});
saveButton.addEventListener('click', () => {
  try { localStorage.setItem('kickers-avatar-v1', JSON.stringify(config)); savedLabel.textContent = 'CHARACTER SAVED ON THIS DEVICE'; }
  catch { savedLabel.textContent = 'SAVE NOT AVAILABLE'; }
});
try {
  const saved = localStorage.getItem('kickers-avatar-v1');
  if (saved) {
    config = { ...defaults, ...JSON.parse(saved) as Partial<AvatarConfig> };
    if (config.shirtImage) applyShirtImage(config.shirtImage);
    rebuildPlayer();
    for (const id of ['skin-color','outfit-color','shoe-color','hair-color']) (document.querySelector<HTMLInputElement>('#'+id)!).value = String(config[id === 'skin-color' ? 'skin' : id === 'outfit-color' ? 'outfit' : id === 'shoe-color' ? 'shoes' : 'hairColor']);
    for (const id of ['hair-style','accessory']) (document.querySelector<HTMLSelectElement>('#'+id)!).value = String(config[id === 'hair-style' ? 'hairStyle' : 'accessory']);
    for (const [id,key] of [['body-width','bodyWidth'],['body-height','bodyHeight'],['head-size','headSize'],['leg-length','legLength']] as const) {
      const el = document.querySelector<HTMLInputElement>('#'+id)!; el.value = String(config[key]);
      (document.querySelector<HTMLOutputElement>('#'+id+'-value')!).value = Number(config[key]).toFixed(1);
    }
  }
} catch { /* Ignore an invalid local saved design. */ }

let moveX = 0, moveZ = 0, kickTime = 0, walkTime = 0, kickHitDone = false;
const keys = new Set<string>();
const clock = new THREE.Clock();
addEventListener('keydown', (event) => { keys.add(event.key.toLowerCase()); if (event.code === 'Space') { event.preventDefault(); kick(); } });
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
function kick() {
  if (kickTime > 0) return;
  kickTime = 0.48;
  kickHitDone = false;
  statusEl.textContent = 'FOOT KICK!';
  kickButton.classList.add('pressed');
  setTimeout(() => kickButton.classList.remove('pressed'), 160);
}
kickButton.addEventListener('pointerdown', kick);
let pointerId: number | null = null;
let joyCenter = { x: 0, y: 0 };
joystick.addEventListener('pointerdown', (event) => {
  pointerId = event.pointerId; joystick.setPointerCapture(pointerId);
  const rect = joystick.getBoundingClientRect(); joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  updateStick(event.clientX, event.clientY);
});
joystick.addEventListener('pointermove', (event) => { if (event.pointerId === pointerId) updateStick(event.clientX, event.clientY); });
function updateStick(x: number, y: number) {
  const dx = x - joyCenter.x, dy = y - joyCenter.y, length = Math.max(1, Math.hypot(dx, dy)), scale = Math.min(1, 42 / length);
  moveX = dx * scale / 42; moveZ = dy * scale / 42;
  stick.style.transform = `translate(${moveX * 42}px, ${moveZ * 42}px)`;
}
function releaseStick() { pointerId = null; moveX = 0; moveZ = 0; stick.style.transform = 'translate(0, 0)'; }
joystick.addEventListener('pointerup', releaseStick); joystick.addEventListener('pointercancel', releaseStick);

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);\n  networkSendClock += delta;\n  if (networkReady && networkSendClock >= 0.05) {\n    networkSendClock = 0;\n    sendNetwork({ type: 'state', x: player.position.x, z: player.position.z, rotation: player.rotation.y });\n  }
  const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const z = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  const inputX = x || moveX, inputZ = z || moveZ, length = Math.hypot(inputX, inputZ) || 1;
  const moving = Math.abs(inputX) + Math.abs(inputZ) > 0.05;
  player.position.x = THREE.MathUtils.clamp(player.position.x + inputX / length * 5 * delta, -8, 8);
  player.position.z = THREE.MathUtils.clamp(player.position.z + inputZ / length * 5 * delta, -8, 8);
  // Alternate legs and counter-swing arms for a grounded walk cycle.
  if (moving) player.rotation.y = Math.atan2(inputX, -inputZ);
  walkTime += delta * (moving ? 10 : 3);
  const stride = moving ? Math.sin(walkTime) * 0.48 : 0;
  const leftLeg = player.userData.leftLeg as THREE.Group;
  const rightLeg = player.userData.kickLeg as THREE.Group;
  const leftArm = player.userData.leftArm as THREE.Mesh;
  const rightArm = player.userData.rightArm as THREE.Mesh;
  if (kickTime <= 0) {
    leftLeg.rotation.x = stride;
    rightLeg.rotation.x = -stride;
  }
  leftArm.rotation.x = moving ? -stride * 0.45 : 0;
  rightArm.rotation.x = moving ? stride * 0.45 : 0;
  player.position.y = moving ? Math.abs(Math.sin(walkTime * 2)) * 0.025 : 0;
  if (kickTime > 0) {
    kickTime = Math.max(0, kickTime - delta);
    const progress = 1 - kickTime / 0.48;
    const swing = Math.sin(progress * Math.PI);
    const kickLeg = player.userData.kickLeg as THREE.Group;
    const kickShin = player.userData.kickShin as THREE.Group;
    // Lift the thigh, extend the shin, and send the sneaker forward (-Z).
    kickLeg.rotation.x = swing * 1.05;
    kickShin.rotation.x = -swing * 0.22;
    player.rotation.x = -swing * 0.07;

    // Register one impact during the forward part of each kick.
    if (!kickHitDone && progress >= 0.32 && progress <= 0.68) {
      kickHitDone = true;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion).normalize();
      let landedHit = false;
      rivals.forEach((rival) => {
        const offset = new THREE.Vector3(
          rival.position.x - player.position.x,
          0,
          rival.position.z - player.position.z
        );
        const distance = offset.length();
        if (distance > 0.001 && distance <= 2.35) {
          const towardRival = offset.clone().normalize();
          if (forward.dot(towardRival) > 0.42) {
            const impulse = (rival.userData.knockback as THREE.Vector3 | undefined) ?? new THREE.Vector3();
            impulse.x += towardRival.x * 8.5;
            impulse.z += towardRival.z * 8.5;
            impulse.y = Math.max(impulse.y, 4.8);
            rival.userData.knockback = impulse;
            landedHit = true;
          }
        }
      });
      if (landedHit) statusEl.textContent = 'HIT!';
    }

    if (kickTime <= 0) {
      kickLeg.rotation.x = 0;
      kickShin.rotation.x = 0;
      player.rotation.x = 0;
      statusEl.textContent = 'READY';
    }
  }
  remotePlayers.forEach(remote => {\n    remote.mesh.position.x += (remote.targetX - remote.mesh.position.x) * Math.min(1, delta * 14);\n    remote.mesh.position.z += (remote.targetZ - remote.mesh.position.z) * Math.min(1, delta * 14);\n    remote.mesh.rotation.y += (remote.targetRotation - remote.mesh.rotation.y) * Math.min(1, delta * 12);\n    const remoteKick = Number(remote.mesh.userData.remoteKickTime || 0);\n    if (remoteKick > 0) {\n      remote.mesh.userData.remoteKickTime = Math.max(0, remoteKick - delta);\n      const leg = remote.mesh.userData.kickLeg as THREE.Group;\n      leg.rotation.x = Math.sin((1 - remoteKick / 0.48) * Math.PI) * 0.9;\n    } else { (remote.mesh.userData.kickLeg as THREE.Group).rotation.x = 0; }\n  });\n  if (!networkReady) rivals.forEach((rival, i) => {
    const velocity = (rival.userData.knockback as THREE.Vector3 | undefined) ?? new THREE.Vector3();
    velocity.y -= 13 * delta;
    rival.position.addScaledVector(velocity, delta);
    const drag = Math.exp(-2.4 * delta);
    velocity.x *= drag;
    velocity.z *= drag;
    if (rival.position.y < 0) {
      rival.position.y = 0;
      if (velocity.y < -1.2) velocity.y = -velocity.y * 0.22;
      else velocity.y = 0;
    }
    if (rival.position.y === 0 && Math.abs(velocity.x) + Math.abs(velocity.z) < 0.08) {
      velocity.x = 0;
      velocity.z = 0;
    }
    rival.userData.knockback = velocity;
    rival.rotation.y += delta * (i % 2 ? 0.35 : -0.3);
  });
  // Wider, higher follow camera keeps more of the arena visible on mobile.
  const cameraTargetX = player.position.x * 0.22;
  const cameraTargetZ = player.position.z + 20;
  camera.position.x += (cameraTargetX - camera.position.x) * 0.04;
  camera.position.y += (14 - camera.position.y) * 0.04;
  camera.position.z += (cameraTargetZ - camera.position.z) * 0.04;
  camera.lookAt(player.position.x * 0.15, 0, player.position.z * 0.2);
  renderer.render(scene, camera);
}
animate();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); });
