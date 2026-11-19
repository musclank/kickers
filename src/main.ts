import * as THREE from 'three';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const statusEl = document.querySelector<HTMLSpanElement>('#status')!;
const kickButton = document.querySelector<HTMLButtonElement>('#kick')!;
const danceButton = document.querySelector<HTMLButtonElement>('#taunt')!;
const styleButton = document.querySelector<HTMLButtonElement>('#mock')!;
const specialButton = document.querySelector<HTMLButtonElement>('#special')!;
const powerupStatus = document.querySelector<HTMLElement>('#powerup-status')!;
const joystick = document.querySelector<HTMLDivElement>('#joystick')!;
const stick = document.querySelector<HTMLDivElement>('#stick')!;
const creator = document.querySelector<HTMLDivElement>('#creator')!;
const creatorToggle = document.querySelector<HTMLButtonElement>('#creator-toggle')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save-character')!;
const savedLabel = document.querySelector<HTMLSpanElement>('#saved-label')!;
const fullscreenButton = document.querySelector<HTMLButtonElement>('#fullscreen-toggle')!;
const matchTimeEl = document.querySelector<HTMLElement>('#match-time')!;
const matchOverEl = document.querySelector<HTMLDivElement>('#match-over')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause-toggle')!;
const pauseOverlay = document.querySelector<HTMLDivElement>('#pause-overlay')!;
const resumeButton = document.querySelector<HTMLButtonElement>('#resume-game')!;
const playAgainButton = document.querySelector<HTMLButtonElement>('#play-again')!;
const matchOverTitle = matchOverEl.querySelector<HTMLHeadingElement>('h2')!;
const matchOverMessage = matchOverEl.querySelector<HTMLParagraphElement>('p')!;

/* KICKERS procedural arcade audio: no external audio files required. */
const audioToggle = document.querySelector<HTMLButtonElement>('#audio-toggle')!;
const audioVolume = document.querySelector<HTMLInputElement>('#audio-volume')!;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let soundEnabled = localStorage.getItem('kickers-sound-enabled') !== 'false';
let soundVolume = Number(localStorage.getItem('kickers-sound-volume') || '35') / 100;
audioVolume.value = String(Math.round(soundVolume * 100));
function updateAudioUI() {
  audioToggle.textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
  audioToggle.classList.toggle('muted', !soundEnabled);
  audioToggle.setAttribute('aria-pressed', String(soundEnabled));
}
function ensureAudio() {
  if (!soundEnabled) return;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext;
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = soundVolume;
    masterGain.connect(audioContext.destination);
    musicGain = audioContext.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(masterGain);
  }
  if (audioContext.state === 'suspended') void audioContext.resume();
  startArcadeMusic();
}
function tone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.25, slideTo?: number) {
  if (!soundEnabled) return;
  ensureAudio();
  if (!audioContext || !masterGain) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, frequency), now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain); gain.connect(masterGain);
  osc.start(now); osc.stop(now + duration + 0.03);
}
function noiseBurst(duration = 0.16, volume = 0.2, filterFrequency = 900) {
  if (!soundEnabled) return;
  ensureAudio();
  if (!audioContext || !masterGain) return;
  const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  filter.type = 'lowpass'; filter.frequency.value = filterFrequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(masterGain);
  source.start(); source.stop(audioContext.currentTime + duration);
}
function playSound(kind: 'kick' | 'impact' | 'dance' | 'pose' | 'fall' | 'victory' | 'ui' | 'countdown') {
  if (!soundEnabled) return;
  ensureAudio();
  if (!audioContext) return;
  if (kind === 'kick') { tone(170, 0.13, 'triangle', 0.22, 65); noiseBurst(0.09, 0.09, 1500); }
  if (kind === 'impact') { tone(105, 0.2, 'sawtooth', 0.3, 42); noiseBurst(0.17, 0.26, 650); }
  if (kind === 'dance') { tone(520, 0.11, 'square', 0.11, 760); window.setTimeout(() => tone(680, 0.13, 'square', 0.1, 920), 90); }
  if (kind === 'pose') { tone(420, 0.16, 'sine', 0.13, 180); window.setTimeout(() => tone(240, 0.2, 'triangle', 0.12, 520), 110); }
  if (kind === 'fall') { tone(360, 0.55, 'sawtooth', 0.16, 55); noiseBurst(0.28, 0.12, 500); }
  if (kind === 'victory') { [523, 659, 784, 1047].forEach((note, i) => window.setTimeout(() => tone(note, 0.42, 'triangle', 0.16), i * 145)); window.setTimeout(() => tone(1318, 0.65, 'sine', 0.14), 620); }
  if (kind === 'ui') { tone(620, 0.08, 'sine', 0.09, 840); }
  if (kind === 'countdown') { tone(880, 0.12, 'square', 0.13); }
}
function startArcadeMusic() {
  if (!audioContext || !musicGain || musicTimer !== null || !soundEnabled) return;
  const notes = [110, 164.81, 220, 164.81, 130.81, 196, 261.63, 196, 98, 146.83, 196, 146.83, 123.47, 185, 246.94, 185];
  musicTimer = window.setInterval(() => {
    if (!audioContext || !musicGain || !soundEnabled || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    const root = notes[musicStep % notes.length];
    const osc = audioContext.createOscillator();
    const env = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    osc.type = 'triangle'; osc.frequency.value = root;
    filter.type = 'lowpass'; filter.frequency.value = 520;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.11, now + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.27);
    osc.connect(filter); filter.connect(env); env.connect(musicGain);
    osc.start(now); osc.stop(now + 0.29);
    if (musicStep % 4 === 0) {
      const sub = audioContext.createOscillator();
      const subEnv = audioContext.createGain();
      sub.type = 'sine'; sub.frequency.value = root / 2;
      subEnv.gain.setValueAtTime(0.0001, now);
      subEnv.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
      subEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      sub.connect(subEnv); subEnv.connect(musicGain); sub.start(now); sub.stop(now + 0.24);
    }
    musicStep++;
  }, 300);
}
audioToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('kickers-sound-enabled', String(soundEnabled));
  if (soundEnabled) { ensureAudio(); if (musicGain && audioContext) musicGain.gain.setTargetAtTime(0.16, audioContext.currentTime, 0.08); playSound('ui'); }
  else if (audioContext && musicGain) { musicGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.08); }
  updateAudioUI();
});
audioVolume.addEventListener('input', () => {
  soundVolume = Number(audioVolume.value) / 100;
  localStorage.setItem('kickers-sound-volume', String(Math.round(soundVolume * 100)));
  if (masterGain && audioContext) masterGain.gain.setTargetAtTime(soundVolume, audioContext.currentTime, 0.04);
});
window.addEventListener('pointerdown', () => { if (soundEnabled) ensureAudio(); }, { once: true });
window.addEventListener('keydown', () => { if (soundEnabled) ensureAudio(); }, { once: true });
updateAudioUI();


type AvatarConfig = {
  headType: 'human' | 'wolf' | 'fox' | 'bear' | 'bull' | 'shark' | 'skull' | 'alien';
  characterType: 'human' | 'robot'; skin: string; outfit: string; shoes: string; hairColor: string; hairStyle: string; accessory: string;
  pants: string; gloves: string; eyeColor: string; eyeStyle: string; topStyle: 'jacket' | 'hoodie' | 'armor' | 'tee'; pantsStyle: 'shorts' | 'long' | 'joggers'; shoeStyle: 'sneakers' | 'high-tops' | 'boots' | 'futuristic';
  bodyWidth: number; bodyHeight: number; headSize: number; legLength: number; shirtImage?: string; fighterId?: string;
};
const defaults: AvatarConfig = {
  headType: 'human', characterType: 'human', skin: '#4de2d0', outfit: '#ffb84d', shoes: '#24243a', hairColor: '#26314d', hairStyle: 'smooth',
  accessory: 'none', pants: '#33415f', gloves: '#e8edf5', eyeColor: '#172033', eyeStyle: 'round', topStyle: 'tee', pantsStyle: 'long', shoeStyle: 'sneakers', bodyWidth: 1, bodyHeight: 1, headSize: 1, legLength: 1, fighterId: 'classic'
};
const fighterPresets: Record<string, AvatarConfig> = {
  classic: { ...defaults, fighterId: 'classic' },
  blaze: { ...defaults, headType: 'wolf', fighterId: 'blaze', skin: '#d98b62', outfit: '#c93632', shoes: '#24202b', hairColor: '#f3a33c', hairStyle: 'spiky', accessory: 'none', bodyWidth: 1.16, bodyHeight: 1.08, headSize: 0.96, legLength: 1.05 },
  shadow: { ...defaults, headType: 'skull', fighterId: 'shadow', skin: '#b6b9d2', outfit: '#242b49', shoes: '#101522', hairColor: '#121827', hairStyle: 'none', accessory: 'glasses', bodyWidth: 0.84, bodyHeight: 1.12, headSize: 0.94, legLength: 1.22 },
  titan: { ...defaults, headType: 'bear', fighterId: 'titan', skin: '#8cbd82', outfit: '#65717e', shoes: '#303945', hairColor: '#303945', hairStyle: 'none', accessory: 'none', bodyWidth: 1.42, bodyHeight: 1.22, headSize: 0.88, legLength: 0.86 },
  venom: { ...defaults, headType: 'alien', fighterId: 'venom', skin: '#b7e0d2', outfit: '#56318a', shoes: '#1c1830', hairColor: '#251b38', hairStyle: 'none', accessory: 'horns', bodyWidth: 1.02, bodyHeight: 1.02, headSize: 1.18, legLength: 1.02 },
  nova: { ...defaults, headType: 'fox', fighterId: 'nova', skin: '#e5b7a3', outfit: '#167e9a', shoes: '#d5e8f0', hairColor: '#e8f2ff', hairStyle: 'smooth', accessory: 'crown', bodyWidth: 0.94, bodyHeight: 1.08, headSize: 1.08, legLength: 1.12 },
  frost: { ...defaults, headType: 'shark', fighterId: 'frost', skin: '#a6c9e8', outfit: '#dce9f4', shoes: '#536c91', hairColor: '#80bde9', hairStyle: 'spiky', accessory: 'none', bodyWidth: 0.98, bodyHeight: 1.16, headSize: 0.98, legLength: 1.08 }
};

type FighterMotion = { walkRate: number; stride: number; kickPower: number; idle: number; victory: number };
const fighterMotion: Record<string, FighterMotion> = {
  classic: { walkRate: 10, stride: 0.48, kickPower: 1.05, idle: 1, victory: 0.9 },
  blaze:   { walkRate: 12, stride: 0.58, kickPower: 1.28, idle: 1.25, victory: 1.15 },
  shadow:  { walkRate: 14, stride: 0.34, kickPower: 1.42, idle: 0.65, victory: 0.8 },
  titan:   { walkRate: 7, stride: 0.62, kickPower: 0.92, idle: 1.4, victory: 1.3 },
  venom:   { walkRate: 11, stride: 0.52, kickPower: 1.18, idle: 1.6, victory: 1.05 },
  nova:    { walkRate: 13, stride: 0.42, kickPower: 1.12, idle: 1.1, victory: 1.5 },
  frost:   { walkRate: 9, stride: 0.46, kickPower: 1.32, idle: 0.8, victory: 1.2 }
};
let config: AvatarConfig = { ...defaults };
let characterHasUnsavedChanges = false;
function refreshStartCharacterPreview() {
  const name = document.querySelector<HTMLElement>('#start-preview-name');
  const details = document.querySelector<HTMLElement>('#start-preview-details');
  const swatch = document.querySelector<HTMLElement>('#start-preview-swatch');
  const state = document.querySelector<HTMLElement>('#start-preview-state');
  if (name) name.textContent = (config.fighterId || 'custom').replace(/-/g, ' ').toUpperCase();
  if (details) details.textContent = `${config.headType.toUpperCase()} HEAD · ${config.topStyle.toUpperCase()} · ${config.shoeStyle.toUpperCase()}`;
  if (swatch) swatch.style.background = `linear-gradient(135deg, ${config.outfit}, ${config.shoes})`;
  if (state) state.textContent = characterHasUnsavedChanges ? 'UNSAVED CHANGES' : 'SAVED ON THIS DEVICE';
}
let shirtTexture: THREE.Texture | null = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10152b);
scene.fog = new THREE.Fog(0x10152b, 24, 58);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 14, 20);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// High Quality preset with a mobile-safe pixel ratio cap.
const getQualityPixelRatio = () => Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2);
renderer.setPixelRatio(getQualityPixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);
renderer.domElement.className = 'game-canvas';

scene.add(new THREE.HemisphereLight(0xb8d7ff, 0x24203b, 2.15));
const sun = new THREE.DirectionalLight(0xffffff, 3.1);
sun.position.set(-5, 12, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 42;
sun.shadow.normalBias = 0.035;
sun.shadow.bias = -0.00012;
scene.add(sun);
// Soft fill and warm front lighting add depth without changing the robot silhouette.
const fillLight = new THREE.DirectionalLight(0xb8d8ff, 0.85);
fillLight.position.set(8, 6, -8); scene.add(fillLight);
const frontLight = new THREE.DirectionalLight(0xffe2bd, 0.45);
frontLight.position.set(2, 5, 10); scene.add(frontLight);
// Deep circular chasm surrounds the arena. The dark floor is far below the platform,
// while the inner rock wall makes the drop-off clearly visible from the camera.
const abyssFloor = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 0.5, 64), new THREE.MeshStandardMaterial({ color: 0x080d1b, roughness: 1 }));
abyssFloor.position.y = -9.2; abyssFloor.receiveShadow = true; scene.add(abyssFloor);
const abyssWall = new THREE.Mesh(new THREE.CylinderGeometry(9.12, 9.12, 8.5, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x171d32, roughness: 1, side: THREE.BackSide }));
abyssWall.position.y = -4.75; scene.add(abyssWall);
const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.7, 64), new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.85 }));
floor.position.y = -0.45; floor.receiveShadow = true; scene.add(floor);
const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.22, 12, 80), new THREE.MeshStandardMaterial({ color: 0xffc857, metalness: 0.35, roughness: 0.45 }));
rim.rotation.x = Math.PI / 2; rim.position.y = -0.05; scene.add(rim);

// Compact spectator stands surrounding the arena. Instanced meshes keep the crowd
// lightweight on mobile while giving the stadium a lively, cheering atmosphere.
const crowdStandMaterial = new THREE.MeshStandardMaterial({
  color: 0x202b49, roughness: 0.82, metalness: 0.12, side: THREE.DoubleSide
});
for (let row = 0; row < 3; row++) {
  const stand = new THREE.Mesh(
    new THREE.TorusGeometry(11.15 + row * 0.9, 0.34, 6, 96),
    crowdStandMaterial
  );
  stand.position.y = -0.22 + row * 0.48;
  stand.receiveShadow = true;
  scene.add(stand);
}
const crowdBodyGeometry = new THREE.SphereGeometry(0.25, 7, 6);
const crowdHeadGeometry = new THREE.SphereGeometry(0.17, 8, 7);
const crowdArmGeometry = new THREE.CapsuleGeometry(0.075, 0.34, 3, 6);
const crowdBodyMaterial = new THREE.MeshStandardMaterial({ roughness: 0.72 });
const crowdHeadMaterial = new THREE.MeshStandardMaterial({ roughness: 0.78 });
const crowdArmMaterial = new THREE.MeshStandardMaterial({ roughness: 0.72 });
const crowdCount = 3 * 36;
const crowdBodies = new THREE.InstancedMesh(crowdBodyGeometry, crowdBodyMaterial, crowdCount);
const crowdHeads = new THREE.InstancedMesh(crowdHeadGeometry, crowdHeadMaterial, crowdCount);
const crowdArms = new THREE.InstancedMesh(crowdArmGeometry, crowdArmMaterial, crowdCount * 2);
crowdBodies.frustumCulled = false;
crowdHeads.frustumCulled = false;
crowdArms.frustumCulled = false;
const crowdBodyColors = [0x20c9c3, 0xffbd4a, 0xff6685, 0x8b7cff, 0x62a8ff, 0xe9edf7, 0x78d66b];
const crowdSkinColors = [0xf0b68b, 0x9d6245, 0xd68c65, 0xf2cfaa, 0x70452f];
const crowdDummy = new THREE.Object3D();
const crowdUp = new THREE.Vector3(0, 1, 0);
let crowdIndex = 0;
let crowdCheer = 0;
let crowdAnimationTime = 0;
const crowdBaseMatrices: THREE.Matrix4[] = [];
const crowdHeadBaseMatrices: THREE.Matrix4[] = [];
const crowdArmBaseMatrices: THREE.Matrix4[] = [];
for (let row = 0; row < 3; row++) {
  for (let seat = 0; seat < 36; seat++) {
    const angle = (seat / 36) * Math.PI * 2 + (row % 2) * 0.075;
    const radius = 11.25 + row * 0.9;
    const baseY = -0.12 + row * 0.48;
    const radial = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const inward = radial.clone().negate();
    const facing = Math.atan2(inward.x, inward.z);
    const bodyScale = 0.82 + ((seat * 7 + row * 3) % 5) * 0.075;

    crowdDummy.position.set(radial.x * radius, baseY + 0.48, radial.z * radius);
    crowdDummy.rotation.set(0, facing, 0);
    crowdDummy.scale.set(bodyScale, 1, 0.72);
    crowdDummy.updateMatrix();
    crowdBodies.setMatrixAt(crowdIndex, crowdDummy.matrix);
    crowdBaseMatrices[crowdIndex] = crowdDummy.matrix.clone();
    crowdBodies.setColorAt(crowdIndex, new THREE.Color(crowdBodyColors[(seat * 3 + row * 2) % crowdBodyColors.length]));

    crowdDummy.position.set(radial.x * radius, baseY + 0.88, radial.z * radius);
    crowdDummy.rotation.set(0, facing, 0);
    crowdDummy.scale.set(1, 1, 1);
    crowdDummy.updateMatrix();
    crowdHeads.setMatrixAt(crowdIndex, crowdDummy.matrix);
    crowdHeadBaseMatrices[crowdIndex] = crowdDummy.matrix.clone();
    crowdHeads.setColorAt(crowdIndex, new THREE.Color(crowdSkinColors[(seat + row * 2) % crowdSkinColors.length]));

    for (let side = -1; side <= 1; side += 2) {
      const localOffset = new THREE.Vector3(side * 0.29, 0.79, 0).applyAxisAngle(crowdUp, facing);
      const armDirection = new THREE.Vector3(side * 0.48, 0.72, 0).applyAxisAngle(crowdUp, facing).normalize();
      crowdDummy.position.set(radial.x * radius + localOffset.x, baseY + localOffset.y, radial.z * radius + localOffset.z);
      crowdDummy.quaternion.setFromUnitVectors(crowdUp, armDirection);
      crowdDummy.scale.set(1, 1, 1);
      crowdDummy.updateMatrix();
      crowdArms.setMatrixAt(crowdIndex * 2 + (side === 1 ? 1 : 0), crowdDummy.matrix);
      crowdArmBaseMatrices[crowdIndex * 2 + (side === 1 ? 1 : 0)] = crowdDummy.matrix.clone();
      crowdArms.setColorAt(crowdIndex * 2 + (side === 1 ? 1 : 0), new THREE.Color(crowdBodyColors[(seat * 3 + row * 2) % crowdBodyColors.length]));
    }
    crowdIndex++;
  }
}
crowdBodies.instanceMatrix.needsUpdate = true;
crowdHeads.instanceMatrix.needsUpdate = true;
crowdArms.instanceMatrix.needsUpdate = true;
if (crowdBodies.instanceColor) crowdBodies.instanceColor.needsUpdate = true;
if (crowdHeads.instanceColor) crowdHeads.instanceColor.needsUpdate = true;
if (crowdArms.instanceColor) crowdArms.instanceColor.needsUpdate = true;
scene.add(crowdBodies, crowdHeads, crowdArms);
// Stadium LED screen facing the arena.
const scoreboardCanvas = document.createElement('canvas');
scoreboardCanvas.width = 1536; scoreboardCanvas.height = 512;
const scoreboardContext = scoreboardCanvas.getContext('2d')!;
scoreboardContext.scale(2, 2);
const scoreboardTexture = new THREE.CanvasTexture(scoreboardCanvas);
scoreboardTexture.colorSpace = THREE.SRGBColorSpace;
type ArenaMarketData = {
  symbol: string; name: string; iconUrl: string | null; priceUsd: number; change24h: number | null;
  marketCap: number | null; liquidity: number | null; volume24h: number | null;
  dexId: string; pairUrl: string; updatedAt: number;
};
const MARKET_TOKEN_ADDRESS = '0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb';
const MARKET_API_URL = `https://api.dexscreener.com/token-pairs/v1/base/${MARKET_TOKEN_ADDRESS}`;
let arenaMarket: ArenaMarketData | null = null;
let marketLoading = true;
let marketError = false;
let scoreboardMessage = 'CONNECTING TO BASE MARKET';
let marketLogo: HTMLImageElement | null = null;
const marketZoomButton = document.createElement('button');
marketZoomButton.id = 'market-zoom-toggle'; marketZoomButton.type = 'button';
marketZoomButton.className = 'market-zoom-toggle'; marketZoomButton.textContent = 'LIVE MARKET  ·  CONNECTING';
marketZoomButton.setAttribute('aria-label', 'Open live token market details');
document.querySelector('.social-market-column')?.append(marketZoomButton);
marketZoomButton.setAttribute('aria-label', 'Open enlarged live token market');
const marketZoomPanel = document.createElement('section');
marketZoomPanel.id = 'market-zoom-panel'; marketZoomPanel.className = 'market-zoom-panel';
marketZoomPanel.hidden = true;
marketZoomPanel.setAttribute('role', 'dialog'); marketZoomPanel.setAttribute('aria-modal', 'true');
marketZoomPanel.setAttribute('aria-label', 'Live Base token market');
marketZoomPanel.innerHTML = `
  <div class="market-zoom-card">
    <button class="market-zoom-close" type="button" aria-label="Close live market">CLOSE</button>
    <div class="market-zoom-brand"><img class="market-zoom-icon" alt="Token official icon"><div><span>BASE NETWORK · LIVE MARKET</span><h2 class="market-zoom-name">TOKEN MARKET</h2><code>${MARKET_TOKEN_ADDRESS}</code></div></div>
    <div class="market-zoom-price"><strong class="market-zoom-price-value">—</strong><span class="market-zoom-change">WAITING FOR DATA</span></div>
    <div class="market-zoom-metrics">
      <div><span>MARKET CAP</span><strong class="market-zoom-cap">—</strong></div>
      <div><span>LIQUIDITY</span><strong class="market-zoom-liquidity">—</strong></div>
      <div><span>24H VOLUME</span><strong class="market-zoom-volume">—</strong></div>
    </div>
    <div class="market-zoom-footer"><span class="market-zoom-updated">UPDATING EVERY 30 SECONDS</span><a class="market-zoom-link" href="https://dexscreener.com/base/${MARKET_TOKEN_ADDRESS}" target="_blank" rel="noopener noreferrer">OPEN DEXSCREENER</a></div>
  </div>`;
document.getElementById('app')?.append(marketZoomPanel);
const marketZoomImage = marketZoomPanel.querySelector<HTMLImageElement>('.market-zoom-icon')!;
function updateMarketZoom() {
  if (!arenaMarket) {
    marketZoomButton.textContent = marketLoading ? 'LIVE MARKET  ·  CONNECTING' : 'LIVE MARKET  ·  NO DATA';
    return;
  }
  marketZoomButton.textContent = `LIVE MARKET  ·  ${arenaMarket.symbol}  ${formatMarketUsd(arenaMarket.priceUsd)}`;
  marketZoomImage.src = arenaMarket.iconUrl || '';
  marketZoomImage.hidden = !arenaMarket.iconUrl;
  marketZoomPanel.querySelector<HTMLElement>('.market-zoom-name')!.textContent = arenaMarket.name + ' · ' + arenaMarket.symbol;
  marketZoomPanel.querySelector<HTMLElement>('.market-zoom-price-value')!.textContent = formatMarketUsd(arenaMarket.priceUsd);
  const change = arenaMarket.change24h;
  const changeEl = marketZoomPanel.querySelector<HTMLElement>('.market-zoom-change')!;
  changeEl.textContent = change === null ? '24H CHANGE —' : `${change >= 0 ? '▲ +' : '▼ '}${change.toFixed(2)}%  ·  24H`;
  changeEl.classList.toggle('positive', change !== null && change >= 0);
  changeEl.classList.toggle('negative', change !== null && change < 0);
  marketZoomPanel.querySelector<HTMLElement>('.market-zoom-cap')!.textContent = formatMarketUsd(arenaMarket.marketCap, true);
  marketZoomPanel.querySelector<HTMLElement>('.market-zoom-liquidity')!.textContent = formatMarketUsd(arenaMarket.liquidity, true);
  marketZoomPanel.querySelector<HTMLElement>('.market-zoom-volume')!.textContent = formatMarketUsd(arenaMarket.volume24h, true);
  marketZoomPanel.querySelector<HTMLElement>('.market-zoom-updated')!.textContent = 'UPDATED ' + new Date(arenaMarket.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  marketZoomPanel.querySelector<HTMLAnchorElement>('.market-zoom-link')!.href = arenaMarket.pairUrl;
}
marketZoomButton.addEventListener('click', () => { updateMarketZoom(); marketZoomPanel.hidden = false; });
marketZoomPanel.querySelector('.market-zoom-close')!.addEventListener('click', () => { marketZoomPanel.hidden = true; });
marketZoomPanel.addEventListener('click', event => { if (event.target === marketZoomPanel) marketZoomPanel.hidden = true; });
window.addEventListener('keydown', event => { if (event.key === 'Escape') marketZoomPanel.hidden = true; });
const formatMarketUsd = (value: number | null, compact = false) => {
  if (value === null || !Number.isFinite(value)) return '—';
  if (compact && value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(3)}`;
  return `$${value.toPrecision(5)}`;
};
function drawArenaScoreboard(message = scoreboardMessage) {
  scoreboardMessage = message;
  const ctx = scoreboardContext;
  ctx.clearRect(0, 0, 768, 256);
  const gradient = ctx.createLinearGradient(0, 0, 768, 256);
  gradient.addColorStop(0, '#07172d'); gradient.addColorStop(0.55, '#10264b'); gradient.addColorStop(1, '#24134b');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 768, 256);
  ctx.strokeStyle = '#55e6e0'; ctx.lineWidth = 7; ctx.strokeRect(7, 7, 754, 242);
  ctx.textAlign = 'left'; ctx.shadowColor = '#42e8ff'; ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffffff'; ctx.font = '900 29px system-ui'; ctx.fillText('KICKERS // BASE MARKET', 28, 43);
  ctx.shadowBlur = 0; ctx.textAlign = 'right'; ctx.fillStyle = '#63f0d2'; ctx.font = '800 17px system-ui';
  ctx.fillText(marketLoading ? 'CONNECTING' : marketError ? 'LIVE FEED DELAYED' : 'LIVE DATA', 738, 41);
  if (arenaMarket) {
    const change = arenaMarket.change24h;
    ctx.textAlign = 'left'; ctx.fillStyle = '#a9c5e8'; ctx.font = '700 18px system-ui';
    ctx.fillText(`${arenaMarket.name.toUpperCase()}  ·  ${arenaMarket.symbol}`, 30, 76);
    if (marketLogo?.complete && marketLogo.naturalWidth > 0) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(682, 53, 54, 54, 12); ctx.clip();
      ctx.drawImage(marketLogo, 682, 53, 54, 54); ctx.restore();
    }
    ctx.shadowColor = change !== null && change >= 0 ? '#46f2ad' : '#ff6685';
    ctx.shadowBlur = 13; ctx.fillStyle = '#ffffff'; ctx.font = '900 58px system-ui';
    ctx.fillText(formatMarketUsd(arenaMarket.priceUsd), 28, 143);
    ctx.shadowBlur = 0; ctx.textAlign = 'right'; ctx.font = '900 28px system-ui';
    ctx.fillStyle = change === null ? '#d7e5f5' : change >= 0 ? '#46f2ad' : '#ff6685';
    ctx.fillText(change === null ? '24H —' : `${change >= 0 ? '▲' : '▼'} ${change >= 0 ? '+' : ''}${change.toFixed(2)}%  24H`, 738, 137);
    const metrics = [
      ['MARKET CAP', formatMarketUsd(arenaMarket.marketCap, true)],
      ['LIQUIDITY', formatMarketUsd(arenaMarket.liquidity, true)],
      ['24H VOLUME', formatMarketUsd(arenaMarket.volume24h, true)]
    ];
    metrics.forEach((item, index) => {
      const x = 30 + index * 242;
      ctx.fillStyle = '#8fa9ca'; ctx.font = '700 14px system-ui'; ctx.textAlign = 'left'; ctx.fillText(item[0], x, 188);
      ctx.fillStyle = '#ffffff'; ctx.font = '900 24px system-ui'; ctx.fillText(item[1], x, 220);
    });
    ctx.textAlign = 'right'; ctx.fillStyle = '#8fa9ca'; ctx.font = '600 12px system-ui';
    ctx.fillText(`${arenaMarket.dexId.toUpperCase()}  ·  UPDATED ${new Date(arenaMarket.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, 738, 238);
  } else {
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = '900 34px system-ui';
    ctx.fillText(marketLoading ? 'LOADING LIVE TOKEN DATA' : 'MARKET DATA UNAVAILABLE', 384, 137);
    ctx.fillStyle = '#a9c5e8'; ctx.font = '600 17px system-ui';
    ctx.fillText(marketLoading ? 'BASE NETWORK  ·  CLANKER' : 'RETRYING AUTOMATICALLY', 384, 183);
  }
  if (message !== 'CONNECTING TO BASE MARKET' && message !== 'LIVE MATCH' && message !== 'ONLINE SHOWDOWN' && message !== 'PRACTICE ROUND') {
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd166'; ctx.font = '800 14px system-ui'; ctx.fillText(message, 738, 65);
  }
  scoreboardTexture.needsUpdate = true;
}
async function refreshArenaMarket() {
  try {
    const response = await fetch(MARKET_API_URL, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Market API ${response.status}`);
    const pairs = await response.json() as Array<{
      chainId?: string; baseToken?: { address?: string; name?: string; symbol?: string }; info?: { imageUrl?: string };
      priceUsd?: string; priceChange?: { h24?: number }; marketCap?: number; fdv?: number;
      liquidity?: { usd?: number }; volume?: { h24?: number }; dexId?: string; url?: string;
    }>;
    const matching = pairs.filter(pair =>
      pair.chainId?.toLowerCase() === 'base' &&
      pair.baseToken?.address?.toLowerCase() === MARKET_TOKEN_ADDRESS.toLowerCase() &&
      Number(pair.priceUsd) > 0
    );
    const bestPair = matching.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (!bestPair) throw new Error('No active Base liquidity pair found');
    let iconUrl = bestPair.info?.imageUrl || null;
    if (!iconUrl) {
      try {
        const profilesResponse = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', { headers: { accept: 'application/json' }, cache: 'no-store' });
        if (profilesResponse.ok) {
          const profiles = await profilesResponse.json() as Array<{ chainId?: string; tokenAddress?: string; icon?: string }>;
          iconUrl = profiles.find(profile => profile.chainId?.toLowerCase() === 'base' && profile.tokenAddress?.toLowerCase() === MARKET_TOKEN_ADDRESS.toLowerCase())?.icon || null;
        }
      } catch (profileError) { console.warn('Token icon metadata unavailable:', profileError); }
    }
    if (iconUrl && iconUrl !== arenaMarket?.iconUrl) {
      const logo = new Image(); logo.crossOrigin = 'anonymous';
      logo.onload = () => { marketLogo = logo; drawArenaScoreboard(); };
      logo.onerror = () => { marketLogo = null; };
      logo.src = iconUrl;
    }
    arenaMarket = {
      iconUrl,
      symbol: bestPair.baseToken?.symbol || 'TOKEN',
      name: bestPair.baseToken?.name || 'Base token',
      priceUsd: Number(bestPair.priceUsd),
      change24h: Number.isFinite(bestPair.priceChange?.h24) ? bestPair.priceChange!.h24! : null,
      marketCap: bestPair.marketCap ?? bestPair.fdv ?? null,
      liquidity: bestPair.liquidity?.usd ?? null,
      volume24h: bestPair.volume?.h24 ?? null,
      dexId: bestPair.dexId || 'DEX',
      pairUrl: bestPair.url || 'https://dexscreener.com/base',
      updatedAt: Date.now()
    };
    marketError = false;
    updateMarketZoom();
  } catch (error) {
    console.warn('KICKERS live market refresh failed:', error);
    marketError = true;
  } finally {
    marketLoading = false;
    drawArenaScoreboard();
  }
}
void refreshArenaMarket();
window.setInterval(() => { void refreshArenaMarket(); }, 30_000);
const scoreboard = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.4), new THREE.MeshBasicMaterial({ map: scoreboardTexture, side: THREE.DoubleSide }));
scoreboard.position.set(0, 5.4, -12.8); scoreboard.rotation.x = -0.08; scene.add(scoreboard);
drawArenaScoreboard();
let scoreboardRefresh = 0;
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

const trophy = new THREE.Group();
const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xffd447, metalness: 0.82, roughness: 0.2 });
const trophyDark = new THREE.MeshStandardMaterial({ color: 0xc58a18, metalness: 0.75, roughness: 0.26 });
const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.56, 0.62, 28, 1, false), goldMaterial);
cup.position.y = 0.55; trophy.add(cup);
const cupTop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 10, 28), goldMaterial);
cupTop.rotation.x = Math.PI / 2; cupTop.position.y = 0.86; trophy.add(cupTop);
for (const side of [-1, 1]) {
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.065, 10, 20, Math.PI), goldMaterial);
  handle.position.set(side * 0.43, 0.61, 0);
  handle.rotation.z = side === -1 ? Math.PI / 2 : -Math.PI / 2;
  trophy.add(handle);
}
const trophyStem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.34, 16), trophyDark);
trophyStem.position.y = 0.08; trophy.add(trophyStem);
const trophyFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.14, 20), goldMaterial);
trophyFoot.position.y = -0.13; trophy.add(trophyFoot);
trophy.visible = false;
scene.add(trophy);

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

function material(color: string) { return new THREE.MeshStandardMaterial({ color, roughness: 0.56, metalness: 0.12 }); }
function addMesh(parent: THREE.Group, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function makeAvatar(cfg: AvatarConfig, x: number, z: number, useShirtTexture = true, targetScene: THREE.Scene = scene) {
  const group = new THREE.Group();
  group.userData.remoteRobot = cfg.characterType === 'robot';
  if (cfg.characterType === 'robot') {
    const green = '#35ad43', greenDark = '#176b32', cream = '#e8d5b6';
    const red = '#df5b42', navy = '#28233f', metal = '#51463b', black = '#10131a';
    const torsoColor = cfg.outfit !== defaults.outfit ? cfg.outfit : navy;
    const armColor = cfg.skin !== defaults.skin ? cfg.skin : cream;
    const bootColor = cfg.shoes !== defaults.shoes ? cfg.shoes : black;
    const metalColor = cfg.shoes !== defaults.shoes ? cfg.shoes : metal;
    // Original compact tracked robot design. Creator settings change colors/accessories,
    // while the signature silhouette and proportions stay intact.
    addMesh(group, new THREE.BoxGeometry(1.12, 0.92, 0.72), torsoColor, 0, 1.28, 0);
    addMesh(group, new THREE.BoxGeometry(0.92, 0.16, 0.76), cream, 0, 0.82, 0);
    addMesh(group, new THREE.BoxGeometry(0.72, 0.10, 0.05), metal, 0, 1.04, -0.39);
    addMesh(group, new THREE.BoxGeometry(0.28, 0.12, 0.06), '#1689d8', 0, 1.47, -0.39);
    const pixels = [
      [-0.12, 1.72, '#f28a25'], [0, 1.61, '#f28a25'], [0, 1.50, '#e9e8d8'],
      [-0.12, 1.39, '#9bd83b'], [0, 1.39, '#9bd83b'], [0.12, 1.39, '#9bd83b'],
      [-0.24, 1.28, '#9bd83b'], [-0.12, 1.28, '#9bd83b'], [0, 1.28, '#9bd83b'], [0.12, 1.28, '#9bd83b'],
      [-0.24, 1.17, '#258de0'], [-0.12, 1.17, '#258de0'], [0, 1.17, '#258de0'], [0.12, 1.17, '#258de0'], [0.24, 1.17, '#258de0']
    ] as Array<[number, number, string]>;
    for (const [px, py, color] of pixels) addMesh(group, new THREE.BoxGeometry(0.115, 0.105, 0.035), color, px, py, -0.385);
    addMesh(group, new THREE.BoxGeometry(1.42, 1.12, 0.92), green, 0, 2.42, 0);
    addMesh(group, new THREE.BoxGeometry(1.28, 0.12, 0.94), greenDark, 0, 1.88, 0);
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.36, 2.48, -0.49);
      addMesh(eye, new THREE.BoxGeometry(0.58, 0.62, 0.13), red, 0, 0, 0);
      addMesh(eye, new THREE.BoxGeometry(0.43, 0.47, 0.045), cream, 0, 0, -0.085);
      addMesh(eye, new THREE.BoxGeometry(0.19, 0.40, 0.025), black, side * 0.095, 0, -0.115);
      group.add(eye);
    }
    addMesh(group, new THREE.BoxGeometry(0.74, 0.07, 0.06), black, 0, 1.99, -0.49);
    addMesh(group, new THREE.CylinderGeometry(0.035, 0.05, 0.48, 10), metal, -0.43, 3.08, 0);
    addMesh(group, new THREE.SphereGeometry(0.16, 16, 12), green, -0.43, 3.39, 0);
    addMesh(group, new THREE.SphereGeometry(0.055, 10, 8), '#a7f5a1', -0.48, 3.45, -0.10);
    for (const side of [-1, 1]) {
      const pod = addMesh(group, new THREE.CylinderGeometry(0.23, 0.23, 0.20, 16), cream, side * 0.76, 2.30, 0);
      pod.rotation.z = Math.PI / 2;
      addMesh(group, new THREE.TorusGeometry(0.16, 0.035, 8, 16), metal, side * 0.88, 2.30, 0);
    }
    const makeArm = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.72, 1.55, 0);
      const upper = addMesh(pivot, new THREE.CapsuleGeometry(0.17, 0.38, 5, 10), armColor, side * 0.12, -0.22, 0);
      upper.rotation.z = side * -0.18;
      addMesh(pivot, new THREE.BoxGeometry(0.27, 0.23, 0.30), green, side * 0.16, -0.48, 0);
      addMesh(pivot, new THREE.CapsuleGeometry(0.14, 0.30, 4, 8), armColor, side * 0.20, -0.70, 0);
      addMesh(pivot, new THREE.SphereGeometry(0.19, 12, 10), green, side * 0.20, -0.94, -0.02);
      for (let finger = -1; finger <= 1; finger++) {
        const digit = addMesh(pivot, new THREE.CapsuleGeometry(0.055, 0.13, 4, 6), armColor,
          side * (0.20 + finger * 0.11), -1.12, -0.04);
        digit.rotation.z = finger * 0.22;
        addMesh(pivot, new THREE.SphereGeometry(0.06, 8, 6), green, side * (0.20 + finger * 0.11), -1.22, -0.04);
      }
      group.add(pivot);
      return pivot;
    };
    const leftArm = makeArm(-1), rightArm = makeArm(1);
    const makeTrackLeg = (side: number) => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.36, 0.78, 0.04);
      addMesh(leg, new THREE.CapsuleGeometry(0.14, 0.30, 4, 8), metalColor, 0, -0.20, 0);
      addMesh(leg, new THREE.SphereGeometry(0.18, 12, 10), cream, 0, -0.38, 0);
      const tread = addMesh(leg, new THREE.CapsuleGeometry(0.34, 0.42, 8, 14), bootColor, 0, -0.68, 0.02);
      tread.rotation.z = Math.PI / 2;
      tread.scale.set(1, 1, 0.88);
      for (const wheelX of [-0.22, 0, 0.22]) {
        const wheel = addMesh(leg, new THREE.CylinderGeometry(0.19, 0.19, 0.12, 16), metalColor, wheelX, -0.68, -0.04);
        wheel.rotation.x = Math.PI / 2;
        addMesh(leg, new THREE.CylinderGeometry(0.075, 0.075, 0.13, 12), cfg.hairColor !== defaults.hairColor ? cfg.hairColor : '#b58a50', wheelX, -0.68, -0.12).rotation.x = Math.PI / 2;
      }
      group.add(leg);
      return leg;
    };
    const leftLeg = makeTrackLeg(-1), kickLeg = makeTrackLeg(1);
    const kickShin = new THREE.Group();
    kickLeg.add(kickShin);
    group.userData.leftLeg = leftLeg;
    group.userData.kickLeg = kickLeg;
    group.userData.kickShin = kickShin;
    group.userData.leftArm = leftArm;
    group.userData.rightArm = rightArm;
    group.position.set(x, 0, z);
    targetScene.add(group);
    return group;
  }
  const bodyY = 0.85 * cfg.bodyHeight;
  addMesh(group, new THREE.CapsuleGeometry(0.48 * cfg.bodyWidth, 0.55 * cfg.bodyHeight, 6, 12), cfg.outfit, 0, bodyY, 0);
  // Modular upper-body garments are separate meshes, not simple color swaps.
  const garment = new THREE.Group();
  const garmentMat = (color = cfg.outfit, metalness = 0.12, roughness = 0.58) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  if (cfg.topStyle === 'jacket') {
    const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.495 * cfg.bodyWidth, 0.56 * cfg.bodyHeight, 6, 12), garmentMat());
    shell.scale.set(1, 1, 1.035); shell.castShadow = true; garment.add(shell);
    addMesh(garment, new THREE.BoxGeometry(0.045, 0.78 * cfg.bodyHeight, 0.035), '#dce8f5', 0, bodyY, -0.485);
    for (const side of [-1, 1]) {
      const panel = addMesh(garment, new THREE.BoxGeometry(0.18 * cfg.bodyWidth, 0.56 * cfg.bodyHeight, 0.045), cfg.outfit, side * 0.13 * cfg.bodyWidth, bodyY + 0.02, -0.49);
      panel.rotation.z = side * -0.08;
    }
  } else if (cfg.topStyle === 'hoodie') {
    const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.50 * cfg.bodyWidth, 0.57 * cfg.bodyHeight, 6, 12), garmentMat());
    shell.scale.set(1, 1, 1.04); shell.castShadow = true; garment.add(shell);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), garmentMat());
    hood.position.set(0, bodyY + 0.53 * cfg.headSize, 0.23); hood.scale.set(1.05, 0.95, 0.72); hood.castShadow = true; garment.add(hood);
    addMesh(garment, new THREE.BoxGeometry(0.42 * cfg.bodyWidth, 0.055, 0.035), '#d9e4f1', 0, bodyY - 0.18, -0.49);
    for (const side of [-1, 1]) addMesh(garment, new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), '#e8edf5', side * 0.09, bodyY + 0.08, -0.50);
  } else if (cfg.topStyle === 'armor') {
    const plate = new THREE.Mesh(new THREE.CapsuleGeometry(0.505 * cfg.bodyWidth, 0.56 * cfg.bodyHeight, 5, 10), garmentMat('#8795a8', 0.72, 0.3));
    plate.scale.set(1, 1, 1.09); plate.castShadow = true; garment.add(plate);
    addMesh(garment, new THREE.BoxGeometry(0.42 * cfg.bodyWidth, 0.34 * cfg.bodyHeight, 0.10), cfg.outfit, 0, bodyY + 0.08, -0.50);
    addMesh(garment, new THREE.BoxGeometry(0.16, 0.13, 0.08), '#65e7d9', 0, bodyY + 0.08, -0.56);
    for (const side of [-1, 1]) {
      const pad = addMesh(garment, new THREE.SphereGeometry(0.22, 12, 10), '#65758b', side * 0.48 * cfg.bodyWidth, bodyY + 0.25, 0);
      pad.scale.set(1.25, 0.72, 1);
    }
  }
  if (cfg.topStyle !== 'tee') group.add(garment);
  const headY = bodyY + 0.82 * cfg.headSize;
  addMesh(group, new THREE.SphereGeometry(0.39 * cfg.headSize, 20, 16), cfg.skin, 0, headY, 0);
  // Distinct creature silhouettes are built from lightweight procedural meshes.
  // All parts are attached to the avatar group, so they follow movement and animation.
  const headScale = cfg.headSize;
  const ear = (side: number, color = cfg.skin, width = 0.17, height = 0.28, depth = 0.13) => {
    const part = addMesh(group, new THREE.ConeGeometry(width * headScale, height * headScale, 10), color,
      side * 0.25 * headScale, headY + 0.31 * headScale, -0.015);
    part.rotation.z = side * -0.18;
    part.scale.z = depth / 0.13;
    return part;
  };
  if (cfg.headType === 'wolf' || cfg.headType === 'fox') {
    const earColor = cfg.headType === 'fox' ? '#e87932' : cfg.skin;
    ear(-1, earColor, cfg.headType === 'fox' ? 0.13 : 0.17, cfg.headType === 'fox' ? 0.48 : 0.38);
    ear(1, earColor, cfg.headType === 'fox' ? 0.13 : 0.17, cfg.headType === 'fox' ? 0.48 : 0.38);
    for (const side of [-1, 1]) addMesh(group, new THREE.ConeGeometry(0.055 * headScale, 0.22 * headScale, 8), '#f4d5c2',
      side * 0.25 * headScale, headY + 0.29 * headScale, -0.105);
    const muzzle = addMesh(group, new THREE.SphereGeometry(0.17 * headScale, 14, 10), cfg.headType === 'fox' ? '#f4b36f' : '#d9dce5',
      0, headY - 0.09 * headScale, -0.30 * headScale);
    muzzle.scale.set(1.12, 0.72, 0.78);
  } else if (cfg.headType === 'bear') {
    for (const side of [-1, 1]) {
      const outer = addMesh(group, new THREE.SphereGeometry(0.17 * headScale, 12, 10), cfg.skin, side * 0.30 * headScale, headY + 0.25 * headScale, 0);
      outer.scale.set(1, 1, 0.65);
      const inner = addMesh(group, new THREE.SphereGeometry(0.085 * headScale, 10, 8), '#d99b82', side * 0.30 * headScale, headY + 0.25 * headScale, -0.105);
      inner.scale.z = 0.45;
    }
    const muzzle = addMesh(group, new THREE.SphereGeometry(0.19 * headScale, 14, 10), '#d9b9a4', 0, headY - 0.10 * headScale, -0.30 * headScale);
    muzzle.scale.set(1.15, 0.72, 0.7);
  } else if (cfg.headType === 'bull') {
    for (const side of [-1, 1]) {
      const horn = addMesh(group, new THREE.ConeGeometry(0.12 * headScale, 0.46 * headScale, 10), '#eee2c8',
        side * 0.32 * headScale, headY + 0.30 * headScale, 0.02);
      horn.rotation.z = side * -0.82;
    }
    const muzzle = addMesh(group, new THREE.SphereGeometry(0.18 * headScale, 12, 10), '#d99b82', 0, headY - 0.12 * headScale, -0.30 * headScale);
    muzzle.scale.set(1.15, 0.65, 0.7);
  } else if (cfg.headType === 'shark') {
    const fin = addMesh(group, new THREE.ConeGeometry(0.19 * headScale, 0.42 * headScale, 4), '#a9c8d7', 0, headY + 0.40 * headScale, 0.02);
    fin.rotation.z = Math.PI;
    const snout = addMesh(group, new THREE.ConeGeometry(0.22 * headScale, 0.42 * headScale, 12), '#a9c8d7', 0, headY - 0.08 * headScale, -0.36 * headScale);
    snout.rotation.x = -Math.PI / 2;
    for (let tooth = -2; tooth <= 2; tooth++) addMesh(group, new THREE.ConeGeometry(0.035 * headScale, 0.09 * headScale, 6), '#ffffff',
      tooth * 0.065 * headScale, headY - 0.22 * headScale, -0.43 * headScale);
  } else if (cfg.headType === 'skull') {
    const jaw = addMesh(group, new THREE.BoxGeometry(0.43 * headScale, 0.14 * headScale, 0.12 * headScale), '#e5e1d4', 0, headY - 0.25 * headScale, -0.27 * headScale);
    jaw.rotation.x = -0.08;
    for (const side of [-1, 1]) addMesh(group, new THREE.BoxGeometry(0.09 * headScale, 0.12 * headScale, 0.08 * headScale), '#ffffff',
      side * 0.13 * headScale, headY - 0.29 * headScale, -0.34 * headScale);
  } else if (cfg.headType === 'alien') {
    const dome = addMesh(group, new THREE.SphereGeometry(0.40 * headScale, 16, 12), '#75d7a2', 0, headY + 0.06 * headScale, 0);
    dome.scale.set(0.82, 1.22, 0.86);
    for (const side of [-1, 1]) {
      const eye = addMesh(group, new THREE.SphereGeometry(0.105 * headScale, 12, 10), '#171c39',
        side * 0.15 * headScale, headY + 0.015 * headScale, -0.35 * headScale);
      eye.scale.set(0.72, 1.35, 0.55);
      addMesh(group, new THREE.SphereGeometry(0.025 * headScale, 8, 6), '#b8fff0',
        side * 0.15 * headScale, headY + 0.045 * headScale, -0.39 * headScale);
    }
  }
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
  const eyeRadius = cfg.eyeStyle === 'wide' ? 0.075 : 0.055;
  const eyeY = bodyY + (cfg.eyeStyle === 'angry' ? 0.92 : 0.9) * cfg.headSize;
  for (const side of [-1, 1]) {
    const eye = addMesh(group, new THREE.SphereGeometry(eyeRadius, 12, 10), cfg.eyeColor, side * 0.14 * cfg.headSize, eyeY, -0.34 * cfg.headSize);
    eye.scale.y = cfg.eyeStyle === 'slit' ? 0.42 : 1;
    if (cfg.eyeStyle === 'angry') {
      const brow = addMesh(group, new THREE.BoxGeometry(0.15 * cfg.headSize, 0.035, 0.035), cfg.hairColor, side * 0.14 * cfg.headSize, eyeY + 0.09 * cfg.headSize, -0.35 * cfg.headSize);
      brow.rotation.z = side * -0.22;
    }
  }
  const smile = addMesh(group, new THREE.TorusGeometry(0.09 * cfg.headSize, 0.018, 6, 16, Math.PI), '#172033', 0, bodyY + 0.72 * cfg.headSize, -0.355 * cfg.headSize);
  smile.rotation.z = Math.PI;
  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.13, 0.42, 4, 8);
  const leftArm = addMesh(group, armGeo, cfg.skin, -0.58 * cfg.bodyWidth, bodyY + 0.03, 0);
  const rightArm = addMesh(group, armGeo, cfg.skin, 0.58 * cfg.bodyWidth, bodyY + 0.03, 0);
  leftArm.rotation.z = -0.25; rightArm.rotation.z = 0.25;
  for (const side of [-1, 1]) addMesh(group, new THREE.SphereGeometry(0.17, 12, 10), cfg.gloves, side * 0.58 * cfg.bodyWidth, bodyY - 0.29, -0.015);
  // Separate articulated legs: the right leg is the actual kicking leg.
  const legScale = cfg.legLength;
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.22 * cfg.bodyWidth, 0.34 * legScale, 0);
  addMesh(leftLeg, new THREE.CapsuleGeometry(0.155, (cfg.pantsStyle === 'shorts' ? 0.08 : 0.29) * legScale, 4, 8), cfg.pants, 0, -0.16 * legScale, 0);
  addMesh(leftLeg, new THREE.CapsuleGeometry(0.145, 0.25 * legScale, 4, 8), cfg.pantsStyle === 'shorts' ? cfg.skin : cfg.pants, 0, -0.36 * legScale, 0);
  if (cfg.pantsStyle === 'joggers') addMesh(leftLeg, new THREE.TorusGeometry(0.145, 0.025, 6, 14), '#20283b', 0, -0.48 * legScale, 0);
  const makeShoe = (parent: THREE.Group, y: number) => {
    const sole = addMesh(parent, new THREE.BoxGeometry(0.38, 0.10, 0.56), '#20283b', 0, y - 0.07, -0.15);
    const upper = addMesh(parent, new THREE.BoxGeometry(0.34, cfg.shoeStyle === 'boots' ? 0.34 : 0.20, cfg.shoeStyle === 'high-tops' ? 0.48 : 0.50), cfg.shoes, 0, y, -0.13);
    if (cfg.shoeStyle === 'boots') upper.position.y = y + 0.04;
    if (cfg.shoeStyle === 'high-tops') addMesh(parent, new THREE.TorusGeometry(0.13, 0.025, 6, 14), '#e8edf5', 0, y + 0.10, -0.19);
    if (cfg.shoeStyle === 'futuristic') {
      addMesh(parent, new THREE.BoxGeometry(0.30, 0.035, 0.035), '#65e7d9', 0, y + 0.02, -0.39);
      addMesh(parent, new THREE.BoxGeometry(0.12, 0.08, 0.08), '#b9c7e5', 0, y - 0.02, 0.02);
    }
  };
  makeShoe(leftLeg, -0.34 * legScale);
  group.add(leftLeg);

  const kickLeg = new THREE.Group();
  kickLeg.position.set(0.22 * cfg.bodyWidth, 0.34 * legScale, 0);
  addMesh(kickLeg, new THREE.CapsuleGeometry(0.155, (cfg.pantsStyle === 'shorts' ? 0.08 : 0.29) * legScale, 4, 8), cfg.pants, 0, -0.16 * legScale, 0);

  const knee = addMesh(kickLeg, new THREE.SphereGeometry(0.15, 12, 10), cfg.skin, 0, -0.29 * legScale, 0);
  const shin = new THREE.Group();
  shin.position.set(0, -0.29 * legScale, 0);
  addMesh(shin, new THREE.CapsuleGeometry(0.13, 0.25 * legScale, 4, 8), cfg.pantsStyle === 'shorts' ? cfg.skin : cfg.pants, 0, -0.13 * legScale, 0);
  makeShoe(shin, -0.29 * legScale);
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
  // Signature silhouettes make each roster fighter readable at arena distance.
  const fighterId = cfg.fighterId || 'classic';
  if (fighterId === 'blaze') {
    for (const side of [-1, 1]) {
      const pad = addMesh(group, new THREE.SphereGeometry(0.28, 12, 10), '#f5a33b', side * 0.58, bodyY + 0.28, 0);
      pad.scale.set(1.15, 0.72, 1.05);
      addMesh(group, new THREE.BoxGeometry(0.16, 0.34, 0.12), '#ffcf70', side * 0.64, bodyY + 0.02, -0.04);
    }
    const crest = addMesh(group, new THREE.ConeGeometry(0.17, 0.52, 7), '#f5a33b', 0, bodyY + 1.34, 0.03);
    crest.rotation.z = Math.PI;
  } else if (fighterId === 'shadow') {
    const hood = addMesh(group, new THREE.SphereGeometry(0.49, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), '#11182b', 0, bodyY + 0.84, 0.03);
    hood.scale.set(1.05, 1.2, 1.02);
    addMesh(group, new THREE.BoxGeometry(0.52, 0.12, 0.07), '#58e5df', 0, bodyY + 0.88, -0.365);
    const scarf = addMesh(group, new THREE.ConeGeometry(0.22, 0.95, 5), '#313c68', 0.34, bodyY + 0.12, 0.34);
    scarf.rotation.z = -Math.PI / 2.7;
  } else if (fighterId === 'titan') {
    for (const side of [-1, 1]) {
      const pad = addMesh(group, new THREE.BoxGeometry(0.62, 0.34, 0.58), '#aab4bf', side * 0.61, bodyY + 0.28, 0);
      pad.rotation.z = side * -0.12;
      addMesh(group, new THREE.BoxGeometry(0.2, 0.46, 0.16), '#46515e', side * 0.68, bodyY - 0.02, -0.02);
    }
    addMesh(group, new THREE.BoxGeometry(0.58, 0.22, 0.12), '#d9e1e8', 0, bodyY + 0.25, -0.47);
  } else if (fighterId === 'venom') {
    addMesh(group, new THREE.SphereGeometry(0.43, 16, 12), '#25183b', 0, bodyY + 0.84, 0.015);
    addMesh(group, new THREE.BoxGeometry(0.58, 0.12, 0.075), '#b8ff72', 0, bodyY + 0.91, -0.39);
    for (const side of [-1, 1]) {
      const fang = addMesh(group, new THREE.ConeGeometry(0.075, 0.22, 8), '#f4f4e8', side * 0.16, bodyY + 0.62, -0.39);
      fang.rotation.z = Math.PI;
    }
    const tail = addMesh(group, new THREE.CapsuleGeometry(0.09, 0.72, 4, 8), '#6f46a5', 0.48, bodyY - 0.05, 0.35);
    tail.rotation.z = -0.9;
  } else if (fighterId === 'nova') {
    const halo = addMesh(group, new THREE.TorusGeometry(0.48, 0.055, 8, 28), '#8ff4ff', 0, bodyY + 1.48, 0);
    halo.rotation.x = Math.PI / 2.7;
    for (const side of [-1, 1]) {
      const fin = addMesh(group, new THREE.ConeGeometry(0.16, 0.58, 5), '#62d9ee', side * 0.5, bodyY + 0.25, 0.16);
      fin.rotation.z = side * -0.8;
    }
    addMesh(group, new THREE.BoxGeometry(0.46, 0.13, 0.08), '#e6fbff', 0, bodyY + 0.86, -0.37);
  } else if (fighterId === 'frost') {
    for (const side of [-1, 1]) {
      const spike = addMesh(group, new THREE.ConeGeometry(0.16, 0.52, 5), '#a7ddff', side * 0.28, bodyY + 1.26, 0.02);
      spike.rotation.z = side * -0.32;
    }
    const chest = addMesh(group, new THREE.OctahedronGeometry(0.24), '#75d9f4', 0, bodyY + 0.18, -0.46);
    chest.scale.set(1.1, 1.2, 0.45);
    const shoulder = addMesh(group, new THREE.BoxGeometry(0.78, 0.12, 0.5), '#a9d7f2', 0, bodyY + 0.43, 0.02);
  }
  group.position.set(x, 0, z); targetScene.add(group); return group;
}
function setNameLabel(mesh: THREE.Group, name: string) {
  const safeName = (name || 'KICKERS Player').replace(/[<>]/g, '').slice(0, 24);
  let sprite = mesh.userData.nameSprite as THREE.Sprite | undefined;
  if (sprite) {
    const oldMap = sprite.material.map;
    oldMap?.dispose();
    sprite.material.dispose();
    mesh.remove(sprite);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = 'rgba(12, 20, 39, 0.88)';
  ctx.beginPath();
  ctx.roundRect(12, 14, 488, 100, 28);
  ctx.fill();
  ctx.strokeStyle = '#65e7d9';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 42px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(safeName, 256, 65, 450);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  sprite = new THREE.Sprite(material);
  sprite.scale.set(2.35, 0.59, 1);
  sprite.position.set(0, mesh.userData.remoteRobot ? 4.0 : 2.35, 0);
  sprite.renderOrder = 100;
  mesh.add(sprite);
  mesh.userData.nameSprite = sprite;
}

let player = makeAvatar(config, 0, 2);
setNameLabel(player, 'KICKERS Player');
const rivals = [
  makeAvatar({ ...defaults, skin: '#ff6b78', outfit: '#5d293d', accessory: 'horns' }, -4, -2),
  makeAvatar({ ...defaults, skin: '#ffc857', outfit: '#4b5f9a', hairStyle: 'spiky' }, 4, -3),
  makeAvatar({ ...defaults, skin: '#9b83ff', outfit: '#3d725f', accessory: 'crown' }, 1, -6),
  makeAvatar({ ...defaults, skin: '#66d9ff', outfit: '#263d68', shoes: '#f4d35e', hairStyle: 'curly' }, -6.2, -1.2),
  makeAvatar({ ...defaults, skin: '#f3a6d2', outfit: '#613f78', pants: '#292747', accessory: 'glasses' }, -4.8, -4.8),
  makeAvatar({ ...defaults, skin: '#a8e6a1', outfit: '#315b48', shoes: '#e8edf5', hairStyle: 'spiky' }, -1.5, -6.8),
  makeAvatar({ ...defaults, skin: '#d6b18c', outfit: '#8a3d32', pants: '#303b50', accessory: 'cap' }, 2.8, -6.1),
  makeAvatar({ ...defaults, skin: '#e5e7eb', outfit: '#414b5e', shoes: '#65e7d9', accessory: 'visor' }, 6.1, -2.5),
  makeAvatar({ ...defaults, skin: '#f6c177', outfit: '#6a3158', pants: '#384b36', hairStyle: 'curly' }, 5.4, 3.6)
];rivals.forEach((bot, index) => setNameLabel(bot, `BOT 0${index + 1}`));

// Lightweight offline-only collectible: one reusable mesh, no per-frame allocations.
const powerup = new THREE.Group();
const powerupCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: 0x65e7d9, emissive: 0x167e83, emissiveIntensity: 1.1, metalness: 0.35, roughness: 0.25 }));
const powerupRing = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.055, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0x80531a, emissiveIntensity: 0.45, metalness: 0.6, roughness: 0.3 }));
powerupRing.rotation.x = Math.PI / 2;
powerup.add(powerupCore, powerupRing);
powerup.position.set(-3.2, 0.85, 1.2);
powerup.userData.respawn = 0;
type PowerupKind = 'speed' | 'shield' | 'power';
let nextPowerupKind: PowerupKind = 'speed';
const powerupColors: Record<PowerupKind, number> = { speed: 0x65e7d9, shield: 0x69a7ff, power: 0xff786b };
function setPowerupAppearance(kind: PowerupKind) {
  nextPowerupKind = kind;
  (powerupCore.material as THREE.MeshStandardMaterial).color.setHex(powerupColors[kind]);
  (powerupCore.material as THREE.MeshStandardMaterial).emissive.setHex(powerupColors[kind]);
  (powerupRing.material as THREE.MeshStandardMaterial).color.setHex(kind === 'power' ? 0xffd36a : powerupColors[kind]);
  powerup.userData.kind = kind;
}
setPowerupAppearance('speed');
scene.add(powerup);

// Player-attached effect meshes stay hidden until their matching pickup is active.
const speedAura = new THREE.Mesh(
  new THREE.TorusGeometry(0.72, 0.045, 8, 32),
  new THREE.MeshBasicMaterial({ color: 0x65e7d9, transparent: true, opacity: 0.9, depthWrite: false })
);
speedAura.rotation.x = Math.PI / 2;
speedAura.position.y = 0.12;
speedAura.visible = false;
player.add(speedAura);
const shieldAura = new THREE.Mesh(
  new THREE.SphereGeometry(1.18, 20, 14),
  new THREE.MeshBasicMaterial({ color: 0x69a7ff, wireframe: true, transparent: true, opacity: 0.42, depthWrite: false })
);
shieldAura.position.y = 1.05;
shieldAura.visible = false;
player.add(shieldAura);
const powerKickAura = new THREE.Mesh(
  new THREE.TorusGeometry(0.9, 0.075, 10, 32),
  new THREE.MeshBasicMaterial({ color: 0xff786b, transparent: true, opacity: 0.9, depthWrite: false })
);
powerKickAura.rotation.x = Math.PI / 2;
powerKickAura.position.y = 0.22;
powerKickAura.visible = false;
player.add(powerKickAura);

type RemotePlayer = { mesh: THREE.Group; targetX: number; targetZ: number; targetRotation: number; };
const remotePlayers = new Map<string, RemotePlayer>();
const characterTypeInput = document.querySelector<HTMLSelectElement>('#character-type')!;
const onlinePanel = document.querySelector<HTMLDivElement>('#online-panel')!;
const onlineToggle = document.querySelector<HTMLButtonElement>('#online-toggle')!;
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
let onlineHp = 100;
const MULTIPLAYER_SERVER_URL = 'https://kickers-multiplayer.papahjahat9999.workers.dev';
function setOnlineMessage(message: string) { onlineMessage.textContent = message; }
function getWorkerBase() { return MULTIPLAYER_SERVER_URL; }
function updateRoster(players: Array<{ id: string; name?: string; walletAddress?: string | null; avatar?: Partial<AvatarConfig>; x?: number; z?: number; rotation?: number }>) {
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
    const hasLook = Boolean(item.avatar);
    const lookSignature = JSON.stringify(item.avatar || {});
    if (!remote || (hasLook && remote.mesh.userData.remoteAvatarSignature !== lookSignature)) {
      if (remote) {
        scene.remove(remote.mesh);
        remote.mesh.traverse(obj => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
          }
        });
      }
      const look = { ...defaults, ...(item.avatar || {}) };
      const mesh = makeAvatar(look, item.x ?? 0, item.z ?? 0, false);
      mesh.userData.remoteAvatarLoaded = hasLook;
      mesh.userData.remoteAvatarSignature = lookSignature;
      mesh.userData.remoteRobot = look.characterType === 'robot';
      setNameLabel(mesh, item.name || 'KICKERS Player');
      remote = { mesh, targetX: item.x ?? 0, targetZ: item.z ?? 0, targetRotation: item.rotation ?? 0 };
      remotePlayers.set(item.id, remote);
    } else {
      setNameLabel(remote.mesh, item.name || 'KICKERS Player');
    }
    if (remote && typeof item.x === 'number') {
      remote.targetX = item.x;
      remote.targetZ = item.z ?? remote.targetZ;
      remote.targetRotation = item.rotation ?? remote.targetRotation;
    }
  }
  playerCountText.textContent = `${players.length}/10 PLAYERS`;
}
let playerDisplayName = 'KICKERS Player';
let playerWalletAddress: string | null = null;
window.addEventListener('kickers:identity', (event) => {
  const detail = (event as CustomEvent<{ displayName?: string; walletAddress?: string | null }>).detail;
  playerDisplayName = detail?.displayName || 'KICKERS Player';
  playerWalletAddress = detail?.walletAddress || null;
  setNameLabel(player, playerDisplayName);
  if (networkReady) sendNetwork({ type: 'hello', name: playerDisplayName, walletAddress: playerWalletAddress, avatar: { ...config, shirtImage: undefined } });
});

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
    // Joining a room must replace any local/offline session on this device.
    trainingMode = false;
    roundOver = false;
    matchTimeRemaining = MATCH_DURATION;
    startScreen.hidden = true;
    rivals.forEach(rival => { rival.visible = false; });
    setGamePaused(false);
    pauseButton.hidden = true;
    sendNetwork({ type: 'hello', name: playerDisplayName, walletAddress: playerWalletAddress, avatar: { ...config, shirtImage: undefined } });
    setOnlineMessage('CONNECTED — WAITING FOR PLAYERS');
    playSound('ui');
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
      const data = JSON.parse(String(event.data)) as { type: string; players?: Array<{ id: string; name?: string; walletAddress?: string | null; avatar?: Partial<AvatarConfig>; x?: number; z?: number; rotation?: number; hp?: number; knockedOut?: boolean }>; id?: string; x?: number; z?: number; rotation?: number; duration?: number; attackerId?: string; targetId?: string; hp?: number; knockX?: number; knockZ?: number; knockedOut?: boolean; playerId?: string; winnerId?: string };
      if (data.type === 'roster' && data.players) updateRoster(data.players);
      if (data.type === 'match-start') {
        // Explicitly switch both host and guest into the same online match state.
        trainingMode = false;
        startScreen.hidden = true;
        setGamePaused(false);
        rivals.forEach(rival => { rival.visible = false; });
        player.visible = true;
        player.userData.fallen = false;
        roundOver = false;
        matchTimeRemaining = MATCH_DURATION;
        matchTimeEl.classList.remove('urgent');
        onlineHp = 100;
        matchResultRecorded = false;
        matchXpAwarded = false;
        matchXpEarned = 0;
        roundOver = false;
        matchTimeEl.textContent = 'ONLINE';
        statusEl.textContent = 'ONLINE MATCH';
        setOnlineMessage('MATCH LIVE — KNOCK OUT YOUR RIVALS');
        powerupStatus.textContent = 'ONLINE HP: 100';
      }
      if (data.type === 'combat-hit' && data.targetId) {
        if (data.targetId === localPlayerId) {
          onlineHp = Math.max(0, Number(data.hp ?? onlineHp));
          statusEl.textContent = onlineHp > 0 ? `HIT TAKEN · HP ${onlineHp}` : 'KNOCKED OUT';
          powerupStatus.textContent = `ONLINE HP: ${onlineHp}`;
          if (typeof data.knockX === 'number' && typeof data.knockZ === 'number') {
            player.position.x += data.knockX * 0.55;
            player.position.z += data.knockZ * 0.55;
          }
        } else {
          const victim = remotePlayers.get(data.targetId);
          if (victim) {
            victim.mesh.userData.remoteKickTime = 0.48;
            if (data.knockedOut) victim.mesh.visible = false;
          }
        }
      }
      if (data.type === 'knockout' && data.playerId === localPlayerId) {
        player.userData.fallen = true;
        player.userData.fallVelocity = 0;
        player.visible = false;
      }
      if (data.type === 'match-result' && data.winnerId) {
        const won = data.winnerId === localPlayerId;
        roundOver = true;
        matchXpEarned = awardMatchXP(won ? 100 : 25) >= 0 ? (won ? 100 : 25) : 0;
        recordMatchResult(won ? 'win' : 'loss');
        if (won) completeDailyChallenge();
        matchOverTitle.textContent = won ? 'YOU ARE THE CHAMPION!' : 'MATCH OVER';
        matchOverMessage.textContent = won ? 'All rivals eliminated. The arena belongs to you!' : 'You were knocked out. Ready for another match?';
        updateMatchResult();
        matchOverEl.hidden = false;
        matchOverEl.setAttribute('aria-hidden', 'false');
        setOnlineMessage(won ? 'VICTORY — MATCH COMPLETE' : 'MATCH COMPLETE');
      }
      if (data.type === 'state' && data.id && data.id !== localPlayerId) {
        const remote = remotePlayers.get(data.id);
        if (remote && typeof data.x === 'number') {
          remote.targetX = data.x;
          remote.targetZ = data.z ?? remote.targetZ;
          remote.targetRotation = data.rotation ?? remote.targetRotation;
        }
      }
      if (data.type === 'taunt' && data.id && data.id !== localPlayerId) {
        const remote = remotePlayers.get(data.id);
        if (remote) remote.mesh.userData.remoteTauntTime = 1.35;
      }
      if (data.type === 'mock' && data.id && data.id !== localPlayerId) {
        const remote = remotePlayers.get(data.id);
        if (remote) remote.mesh.userData.remoteMockTime = 1.6;
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
    pauseButton.hidden = false;
    socket = null;
    activeRoom = '';
    remotePlayers.forEach(remote => scene.remove(remote.mesh));
    remotePlayers.clear();
    rivals.forEach(rival => { rival.visible = true; });
    roomDisplay.hidden = true;
    createRoomButton.disabled = false;
    joinRoomButton.disabled = false;
    leaveRoomButton.disabled = true;
    playerCountText.textContent = '1/10 PLAYERS';
    statusEl.textContent = 'OFFLINE';
    setOnlineMessage('DISCONNECTED FROM ROOM');
  });
  ws.addEventListener('error', () => setOnlineMessage('CONNECTION ERROR — TRY AGAIN'));
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
onlineToggle.addEventListener('click', () => { onlinePanel.classList.toggle('open'); playSound('ui'); });
createRoomButton.addEventListener('click', () => { playSound('ui'); createOnlineRoom(); });
joinRoomButton.addEventListener('click', () => { playSound('ui'); joinOnlineRoom(); });
leaveRoomButton.addEventListener('click', () => { playSound('ui'); socket?.close(1000, 'Player left'); });

function rebuildPlayer() {
  scene.remove(player);
  player.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); } });
  player = makeAvatar(config, player.position.x, player.position.z);
  setNameLabel(player, playerDisplayName);
  // Reframe after every live edit so larger accessories/body settings stay visible.
  if (customizing) frameCharacterPreview();
  // Keep the current appearance in sync when a player edits their fighter mid-session.
  if (networkReady) sendNetwork({ type: 'hello', name: playerDisplayName, walletAddress: playerWalletAddress, avatar: { ...config, shirtImage: undefined } });
}
const fighterCards = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-fighter]'));
function syncFighterControls() {
  const values: Record<string, string> = {
    'skin-color': config.skin, 'outfit-color': config.outfit, 'shoe-color': config.shoes, 'hair-color': config.hairColor,
    'head-type': config.headType, 'hair-style': config.hairStyle, 'accessory': config.accessory, 'pants-color': config.pants, 'glove-color': config.gloves, 'eye-color': config.eyeColor, 'eye-style': config.eyeStyle, 'top-style': config.topStyle, 'pants-style': config.pantsStyle, 'shoe-style': config.shoeStyle
  };
  for (const [id, value] of Object.entries(values)) {
    const input = document.querySelector<HTMLInputElement | HTMLSelectElement>('#' + id);
    if (input) input.value = value;
  }
  for (const [id, key] of [['body-width','bodyWidth'],['body-height','bodyHeight'],['head-size','headSize'],['leg-length','legLength']] as const) {
    const input = document.querySelector<HTMLInputElement>('#' + id);
    const output = document.querySelector<HTMLOutputElement>('#' + id + '-value');
    if (input) input.value = String(config[key]);
    if (output) output.value = Number(config[key]).toFixed(1);
  }
  const typeInput = document.querySelector<HTMLSelectElement>('#character-type');
  if (typeInput) typeInput.value = config.characterType;
}
function selectFighter(id: string) {
  const preset = fighterPresets[id];
  if (!preset) return;
  config = { ...preset, shirtImage: config.shirtImage };
  rebuildPlayer();
  syncFighterControls();
  fighterCards.forEach(card => {
    const selected = card.dataset.fighter === id;
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  try { localStorage.setItem('kickers-avatar-v1', JSON.stringify(config)); characterHasUnsavedChanges = false; } catch { /* selection remains active for this session */ }
  refreshStartCharacterPreview();
  const label = document.querySelector<HTMLElement>('#selected-fighter-name');
  if (label) label.textContent = id.toUpperCase();
  playSound('ui');
}
fighterCards.forEach(card => card.addEventListener('click', () => selectFighter(card.dataset.fighter || 'classic')));
function bindColor(id: string, key: keyof AvatarConfig) {
  const input = document.querySelector<HTMLInputElement>('#' + id)!;
  input.value = String(config[key]);
  input.addEventListener('input', () => { (config[key] as string) = input.value; rebuildPlayer(); });
}
characterTypeInput.value = config.characterType;
characterTypeInput.addEventListener('change', () => {
  config.characterType = characterTypeInput.value as AvatarConfig['characterType'];
  rebuildPlayer();
  savedLabel.textContent = config.characterType === 'robot' ? 'ROBOT FIGHTER SELECTED — SAVE TO KEEP IT' : 'HUMAN FIGHTER SELECTED — SAVE TO KEEP IT';
});
bindColor('skin-color', 'skin'); bindColor('outfit-color', 'outfit'); bindColor('shoe-color', 'shoes'); bindColor('hair-color', 'hairColor');
bindColor('pants-color', 'pants'); bindColor('glove-color', 'gloves'); bindColor('eye-color', 'eyeColor');

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
bindSelect('head-type', 'headType'); bindSelect('hair-style', 'hairStyle'); bindSelect('accessory', 'accessory'); bindSelect('eye-style', 'eyeStyle'); bindSelect('top-style', 'topStyle'); bindSelect('pants-style', 'pantsStyle'); bindSelect('shoe-style', 'shoeStyle');
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

let customizing = false;
let customizationSnapshot: {
  playerPosition: THREE.Vector3; playerRotation: THREE.Euler; playerVisible: boolean;
  cameraPosition: THREE.Vector3; rivalVisibility: boolean[]; remoteVisibility: boolean[];
} | null = null;
function frameCharacterPreview() {
  // Frame the fighter in the unobstructed upper part of the screen on mobile.
  // The robot's face/chest are on local -Z, so the preview camera must be in front.
  const nameSprite = player.userData.nameSprite as THREE.Sprite | undefined;
  const wasNameVisible = nameSprite?.visible ?? false;
  if (nameSprite) nameSprite.visible = false;
  player.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(player);
  if (nameSprite) nameSprite.visible = wasNameVisible;
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingHalfFov = Math.max(0.12, Math.min(verticalFov, horizontalFov) / 2);
  // Extra breathing room keeps feet and antenna above the creator sheet.
  const distance = Math.max(6.5, sphere.radius / Math.sin(limitingHalfFov) * 1.72);
  camera.position.set(center.x, center.y + distance * 0.08, center.z - distance);
  // Aim slightly below the character's center to shift the fighter upward on screen.
  camera.lookAt(center.x, center.y - sphere.radius * 1.15, center.z);
  camera.updateProjectionMatrix();
}

const arenaThemes = {
  classic: { sky: 0x10152b, floor: 0xf2f4f8, rim: 0xffc857, wall: 0x171d32, deep: 0x080d1b, fog: 0x10152b },
  lava: { sky: 0x241018, floor: 0x38212a, rim: 0xff713d, wall: 0x32151d, deep: 0x10080d, fog: 0x241018 },
  ice: { sky: 0x10283b, floor: 0xd9f3ff, rim: 0x65dfff, wall: 0x183c55, deep: 0x071522, fog: 0x10283b }
} as const;
function applyArenaTheme(id: keyof typeof arenaThemes) {
  const theme = arenaThemes[id] || arenaThemes.classic;
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, 24, 58);
  (floor.material as THREE.MeshStandardMaterial).color.setHex(theme.floor);
  (rim.material as THREE.MeshStandardMaterial).color.setHex(theme.rim);
  (abyssWall.material as THREE.MeshStandardMaterial).color.setHex(theme.wall);
  (abyssFloor.material as THREE.MeshStandardMaterial).color.setHex(theme.deep);
  document.querySelectorAll<HTMLButtonElement>("[data-arena]").forEach(button => {
    const selected = button.dataset.arena === id;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  try { localStorage.setItem("kickers-arena-v1", id); } catch { /* theme remains active for this session */ }
}
const arenaOptions = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-arena]"));
arenaOptions.forEach(button => button.addEventListener("click", () => {
  const id = button.dataset.arena as keyof typeof arenaThemes;
  if (id in arenaThemes) { applyArenaTheme(id); playSound("ui"); }
}));
const savedArena = localStorage.getItem("kickers-arena-v1") as keyof typeof arenaThemes | null;
applyArenaTheme(savedArena && savedArena in arenaThemes ? savedArena : "classic");

let customizationFromStartMenu = false;
function setCustomizationOpen(open: boolean) {
  if (open === customizing) return;
  if (open && roundOver) return;
  customizing = open;
  creator.classList.toggle('open', open);
  document.body.classList.toggle('customizing', open);
  creatorToggle.textContent = open ? 'CONTINUE' : 'CUSTOMIZE';
  if (open) {
    releaseStick();
    keys.clear();
    customizationSnapshot = {
      playerPosition: player.position.clone(),
      playerRotation: player.rotation.clone(),
      playerVisible: player.visible,
      cameraPosition: camera.position.clone(),
      rivalVisibility: rivals.map(bot => bot.visible),
      remoteVisibility: Array.from(remotePlayers.values(), remote => remote.mesh.visible)
    };
    player.position.set(0, 0, 0);
    player.rotation.set(0, 0, 0);
    player.visible = true;
    rivals.forEach(bot => { bot.visible = false; });
    remotePlayers.forEach(remote => { remote.mesh.visible = false; });
    frameCharacterPreview();
    statusEl.textContent = 'CHARACTER PREVIEW';
  } else {
    if (customizationSnapshot) {
      player.position.copy(customizationSnapshot.playerPosition);
      player.rotation.copy(customizationSnapshot.playerRotation);
      player.visible = customizationSnapshot.playerVisible;
      rivals.forEach((bot, index) => { bot.visible = customizationSnapshot!.rivalVisibility[index]; });
      Array.from(remotePlayers.values()).forEach((remote, index) => {
        remote.mesh.visible = customizationSnapshot!.remoteVisibility[index] ?? true;
      });
      camera.position.copy(customizationSnapshot.cameraPosition);
      camera.lookAt(player.position.x * 0.15, 0, player.position.z * 0.2);
    }
    customizationSnapshot = null;
    if (customizationFromStartMenu) {
      startScreen.hidden = false;
      customizationFromStartMenu = false;
      statusEl.textContent = 'READY';
    } else {
      statusEl.textContent = networkReady ? 'ONLINE' : (gamePaused ? 'PAUSED' : 'READY');
    }
  }
}

let previewPointerId: number | null = null;
let previewPointerX = 0;
renderer.domElement.addEventListener("pointerdown", event => {
  if (!customizing) return;
  previewPointerId = event.pointerId;
  previewPointerX = event.clientX;
  renderer.domElement.setPointerCapture(event.pointerId);
  renderer.domElement.style.cursor = "grabbing";
});
renderer.domElement.addEventListener("pointermove", event => {
  if (!customizing || previewPointerId !== event.pointerId) return;
  player.rotation.y += (event.clientX - previewPointerX) * 0.012;
  previewPointerX = event.clientX;
});
const releasePreviewPointer = (event: PointerEvent) => {
  if (previewPointerId !== event.pointerId) return;
  previewPointerId = null;
  renderer.domElement.style.cursor = "";
};
renderer.domElement.addEventListener("pointerup", releasePreviewPointer);
renderer.domElement.addEventListener("pointercancel", releasePreviewPointer);
creatorToggle.addEventListener('click', () => setCustomizationOpen(!customizing));
saveButton.addEventListener('click', () => {
  try {
    localStorage.setItem('kickers-avatar-v1', JSON.stringify(config));
    characterHasUnsavedChanges = false;
    savedLabel.textContent = 'CHARACTER SAVED ON THIS DEVICE';
    refreshStartCharacterPreview();
    playSound('ui');
  } catch { savedLabel.textContent = 'SAVE NOT AVAILABLE'; }
});
creator.addEventListener('input', () => {
  characterHasUnsavedChanges = true;
  savedLabel.textContent = 'UNSAVED CHANGES — SAVE TO KEEP';
  refreshStartCharacterPreview();
});
creator.addEventListener('change', () => {
  characterHasUnsavedChanges = true;
  savedLabel.textContent = 'UNSAVED CHANGES — SAVE TO KEEP';
  refreshStartCharacterPreview();
});
try {
  const saved = localStorage.getItem('kickers-avatar-v1');
  if (saved) {
    config = { ...defaults, ...JSON.parse(saved) as Partial<AvatarConfig> };
    characterTypeInput.value = config.characterType;
    if (config.shirtImage) applyShirtImage(config.shirtImage);
    rebuildPlayer();
    for (const id of ['skin-color','outfit-color','shoe-color','hair-color','pants-color','glove-color','eye-color']) (document.querySelector<HTMLInputElement>('#'+id)!).value = String(config[id === 'skin-color' ? 'skin' : id === 'outfit-color' ? 'outfit' : id === 'shoe-color' ? 'shoes' : 'hairColor']);
    for (const id of ['hair-style','accessory','eye-style']) (document.querySelector<HTMLSelectElement>('#'+id)!).value = String(config[id === 'hair-style' ? 'hairStyle' : 'accessory']);
    for (const [id,key] of [['body-width','bodyWidth'],['body-height','bodyHeight'],['head-size','headSize'],['leg-length','legLength']] as const) {
      const el = document.querySelector<HTMLInputElement>('#'+id)!; el.value = String(config[key]);
      (document.querySelector<HTMLOutputElement>('#'+id+'-value')!).value = Number(config[key]).toFixed(1);
    }
  }
} catch { /* Ignore an invalid local saved design. */ }
const activeFighterId = config.fighterId || 'classic';
fighterCards.forEach(card => {
  const selected = card.dataset.fighter === activeFighterId;
  card.classList.toggle('selected', selected);
  card.setAttribute('aria-pressed', String(selected));
});
const selectedFighterLabel = document.querySelector<HTMLElement>('#selected-fighter-name');
if (selectedFighterLabel) selectedFighterLabel.textContent = activeFighterId.toUpperCase();
refreshStartCharacterPreview();

let moveX = 0, moveZ = 0, kickTime = 0, tauntTime = 0, mockTime = 0, walkTime = 0, kickHitDone = false;
let speedBoostTime = 0, shieldTime = 0, powerKickTime = 0, specialCooldown = 0, powerupRespawn = 0;
let specialTime = 0, specialFighter = 'classic';
let arenaEventClock = 0;
let matchXpAwarded = false;
let matchXpEarned = 0;
let matchResultRecorded = false;
const xpKey = 'kickers-progression-v1';
function awardMatchXP(amount: number) {
  if (matchXpAwarded) return 0;
  matchXpAwarded = true;
  let stats = { xp: 0, wins: 0, losses: 0, matches: 0 };
  try { stats = { ...stats, ...JSON.parse(localStorage.getItem(xpKey) || '{}') }; } catch { /* reset invalid local data */ }
  stats.xp += amount;
  localStorage.setItem(xpKey, JSON.stringify(stats));
  return stats.xp;
}
const achievementKey = 'kickers-achievements-v1';
const achievementDefinitions = [
  { id: 'first-match', title: 'FIRST MATCH', detail: 'Complete your first match.' },
  { id: 'first-victory', title: 'FIRST VICTORY', detail: 'Win your first match.' },
  { id: 'arena-regular', title: 'ARENA REGULAR', detail: 'Complete 10 matches.' },
  { id: 'kicker-10', title: 'KICKER', detail: 'Perform 10 kicks.' }
];
let achievementToastTimer = 0;
function readAchievements(): { unlocked: string[]; kicks: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(achievementKey) || '{}');
    return { unlocked: Array.isArray(saved.unlocked) ? saved.unlocked : [], kicks: Math.max(0, Number(saved.kicks) || 0) };
  } catch { return { unlocked: [], kicks: 0 }; }
}
function showAchievementToast(title: string) {
  const toast = document.querySelector<HTMLElement>('#achievement-toast');
  if (!toast) return;
  toast.textContent = `ACHIEVEMENT UNLOCKED · ${title}`;
  toast.hidden = false;
  window.clearTimeout(achievementToastTimer);
  achievementToastTimer = window.setTimeout(() => { toast.hidden = true; }, 2800);
}
function unlockAchievement(id: string) {
  const progress = readAchievements();
  if (progress.unlocked.includes(id)) return;
  const achievement = achievementDefinitions.find(item => item.id === id);
  if (!achievement) return;
  progress.unlocked.push(id);
  localStorage.setItem(achievementKey, JSON.stringify(progress));
  showAchievementToast(achievement.title);
}
function recordAchievementKick() {
  const progress = readAchievements();
  progress.kicks += 1;
  localStorage.setItem(achievementKey, JSON.stringify(progress));
  if (progress.kicks >= 10) unlockAchievement('kicker-10');
}
function renderAchievements() {
  const list = document.querySelector<HTMLElement>('#achievement-list');
  if (!list) return;
  const progress = readAchievements();
  list.innerHTML = achievementDefinitions.map(item => {
    const unlocked = progress.unlocked.includes(item.id);
    return `<div class="achievement-row${unlocked ? ' unlocked' : ''}"><span class="achievement-mark">${unlocked ? '✓' : '—'}</span><span><strong>${item.title}</strong><small>${item.detail}</small></span><em>${unlocked ? 'UNLOCKED' : 'LOCKED'}</em></div>`;
  }).join('');
}
function recordMatchResult(result: 'win' | 'loss') {
  if (matchResultRecorded) return;
  matchResultRecorded = true;
  let stats = { xp: 0, wins: 0, losses: 0, matches: 0 };
  try { stats = { ...stats, ...JSON.parse(localStorage.getItem(xpKey) || '{}') }; } catch { /* reset invalid local data */ }
  stats.matches += 1;
  if (result === 'win') stats.wins += 1;
  else stats.losses += 1;
  localStorage.setItem(xpKey, JSON.stringify(stats));
  unlockAchievement('first-match');
  if (result === 'win') unlockAchievement('first-victory');
  if (stats.matches >= 10) unlockAchievement('arena-regular');
}
const dailyChallengeKey = 'kickers-daily-challenge-v1';
function getLocalDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function isDailyChallengeComplete() {
  return localStorage.getItem(dailyChallengeKey) === getLocalDayKey();
}
function renderDailyChallenge() {
  const status = document.querySelector<HTMLElement>('#daily-challenge-status');
  const reward = document.querySelector<HTMLElement>('#daily-challenge-reward');
  if (!status || !reward) return;
  const complete = isDailyChallengeComplete();
  status.textContent = complete ? 'COMPLETED TODAY' : '0 / 1 WINS';
  reward.textContent = complete ? 'REWARD CLAIMED · +50 XP' : 'REWARD · +50 XP';
  const card = document.querySelector<HTMLElement>('#daily-challenge');
  card?.classList.toggle('completed', complete);
}
function completeDailyChallenge() {
  if (isDailyChallengeComplete()) return;
  localStorage.setItem(dailyChallengeKey, getLocalDayKey());
  let stats = { xp: 0, wins: 0, losses: 0, matches: 0 };
  try { stats = { ...stats, ...JSON.parse(localStorage.getItem(xpKey) || '{}') }; } catch { /* reset invalid local data */ }
  stats.xp += 50;
  localStorage.setItem(xpKey, JSON.stringify(stats));
  matchXpEarned += 50;
  showAchievementToast('DAILY CHALLENGE COMPLETE · +50 XP');
  renderDailyChallenge();
}
const keys = new Set<string>();
const clock = new THREE.Clock();
const MATCH_DURATION = 300;
let matchTimeRemaining = MATCH_DURATION;
let roundOver = false;
let gamePaused = true;
let trainingMode = false;
let victoryActive = false;
let victoryTime = 0;
let victoryStarted = false;
const PODIUM_HEIGHT = 5.2;
function beginVictory() {
  if (victoryStarted || networkReady || trainingMode) return;
  victoryStarted = true;
  crowdCheer = 2.0;
  drawArenaScoreboard('CHAMPION!');
  victoryActive = true;
  victoryTime = 0;
  moveX = 0; moveZ = 0;
  statusEl.textContent = 'CHAMPION!';
  trophy.visible = false;
  const totalXP = awardMatchXP(100);
  matchXpEarned = 100;
  recordMatchResult('win');
  completeDailyChallenge();
  powerup.visible = false;
  const finalXP = (() => { try { return Number(JSON.parse(localStorage.getItem(xpKey) || '{}').xp || 0); } catch { return totalXP; } })();
  matchOverMessage.textContent = `All rivals eliminated! +${matchXpEarned} XP · Total XP: ${finalXP}`;
  updateMatchResult();
}
function updateMatchResult() {
  const stats = document.querySelector<HTMLElement>('#match-result-stats');
  if (!stats) return;
  const played = MATCH_DURATION - matchTimeRemaining;
  const totalXP = (() => { try { return Number(JSON.parse(localStorage.getItem(xpKey) || '{}').xp || 0); } catch { return 0; } })();
  stats.innerHTML = `<div><strong>${networkReady ? 'ONLINE' : formatMatchTime(played)}</strong><span>${networkReady ? 'MATCH TYPE' : 'TIME PLAYED'}</span></div><div><strong>+${matchXpEarned} XP</strong><span>THIS MATCH</span></div><div><strong>${totalXP} XP</strong><span>TOTAL XP</span></div>`;
}
function formatMatchTime(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
function setGamePaused(paused: boolean) {
  if (((networkReady || roundOver) && paused) || gamePaused === paused) return;
  gamePaused = paused;
  pauseOverlay.hidden = !paused;
  pauseOverlay.setAttribute('aria-hidden', String(!paused));
  pauseButton.textContent = paused ? 'RESUME' : 'PAUSE';
  pauseButton.setAttribute('aria-label', paused ? 'Resume offline game' : 'Pause offline game');
  keys.clear();
  releaseStick();
  if (audioContext) {
    if (paused && audioContext.state === 'running') void audioContext.suspend();
    else if (!paused && soundEnabled && audioContext.state === 'suspended') void audioContext.resume();
  }
  statusEl.textContent = paused ? 'PAUSED' : 'READY';
}
const startScreen = document.querySelector<HTMLDivElement>('#start-screen')!;
const startGameButton = document.querySelector<HTMLButtonElement>('#start-game')!;
const startTrainingButton = document.querySelector<HTMLButtonElement>('#start-training')!;
const startCustomizeButton = document.querySelector<HTMLButtonElement>('#start-customize')!;
const playerStatsButton = document.querySelector<HTMLButtonElement>('#player-stats-button')!;
const playerStatsPanel = document.querySelector<HTMLElement>('#player-stats-panel')!;
const closePlayerStatsButton = document.querySelector<HTMLButtonElement>('#close-player-stats')!;
function renderPlayerStats() {
  let stats = { xp: 0, wins: 0, losses: 0, matches: 0 };
  try { stats = { ...stats, ...JSON.parse(localStorage.getItem(xpKey) || '{}') }; } catch { /* show empty stats */ }
  const winRate = stats.matches ? Math.round((stats.wins / stats.matches) * 100) : 0;
  const values: Record<string, number> = { matches: stats.matches, wins: stats.wins, losses: stats.losses, winRate, xp: stats.xp };
  Object.entries(values).forEach(([key, value]) => {
    const el = playerStatsPanel.querySelector<HTMLElement>(`[data-stat="${key}"]`);
    if (el) el.textContent = key === 'winRate' ? `${value}%` : String(value);
  });
  renderAchievements();
  renderDailyChallenge();
}
playerStatsButton.addEventListener('click', () => { renderPlayerStats(); playerStatsPanel.hidden = false; });
closePlayerStatsButton.addEventListener('click', () => { playerStatsPanel.hidden = true; });
function launchGame(training: boolean) {
  if (training && networkReady) { setOnlineMessage('TRAINING MODE IS OFFLINE-ONLY'); return; }
  trainingMode = training;
  arenaEventClock = 0;
  startScreen.hidden = true;
  matchTimeRemaining = MATCH_DURATION;
  roundOver = false;
  matchTimeEl.textContent = training ? 'TRAINING' : formatMatchTime(matchTimeRemaining);
  matchTimeEl.classList.remove('urgent');
  statusEl.textContent = training ? 'TRAINING MODE' : 'READY';
  setGamePaused(false);
  playSound('ui');
}
startGameButton.addEventListener('click', () => launchGame(false));
startTrainingButton.addEventListener('click', () => launchGame(true));
startCustomizeButton.addEventListener('click', () => {
  customizationFromStartMenu = true;
  startScreen.hidden = true;
  setCustomizationOpen(true);
});
pauseButton.addEventListener('click', () => setGamePaused(!gamePaused));
resumeButton.addEventListener('click', () => setGamePaused(false));
playAgainButton.addEventListener('click', () => location.reload());
addEventListener('keydown', (event) => { if (event.code === 'Escape' || event.key.toLowerCase() === 'p') { event.preventDefault(); setGamePaused(!gamePaused); return; } if (gamePaused) return; keys.add(event.key.toLowerCase()); if (event.code === 'Space') { event.preventDefault(); kick(); } });
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
function playDance() {
  if (roundOver || gamePaused || customizing) return;
  playSound('dance');
  if (tauntTime > 0 || mockTime > 0 || kickTime > 0) return;
  tauntTime = 1.35;
  if (networkReady) sendNetwork({ type: 'taunt' });
  statusEl.textContent = 'DANCE TIME!';
  danceButton.classList.add('pressed');
  setTimeout(() => danceButton.classList.remove('pressed'), 180);
}
danceButton.addEventListener('pointerdown', playDance);
function funnyStyle() {
  if (roundOver || gamePaused || customizing) return;
  playSound('pose');
  if (mockTime > 0 || tauntTime > 0 || kickTime > 0) return;
  mockTime = 1.6;
  if (networkReady) sendNetwork({ type: 'mock' });
  statusEl.textContent = 'FUNNY STYLE!';
  styleButton.classList.add('pressed');
  setTimeout(() => styleButton.classList.remove('pressed'), 180);
}
styleButton.addEventListener('pointerdown', funnyStyle);
function useSpecial() {
  crowdCheer = Math.max(crowdCheer, 1.25);
  drawArenaScoreboard('SPECIAL MOVE!');
  if (roundOver || gamePaused || customizing) return;
  if (networkReady) { setOnlineMessage('SPECIAL MOVES ARE CURRENTLY OFFLINE-ONLY'); return; }
  if (specialCooldown > 0) return;
  if (kickTime > 0 || tauntTime > 0 || mockTime > 0) return;
  specialCooldown = 12;
  const fighter = config.fighterId || 'classic';
  specialFighter = fighter;
  specialTime = 0.78;
  const specialStyles: Record<string, { color: number; radius: number; force: number; lift: number; label: string; duration: number; directional?: boolean }> = {
    classic: { color: 0x65e7d9, radius: 4.2, force: 10, lift: 5.2, label: 'SHOCKWAVE!', duration: 520 },
    blaze:   { color: 0xff713d, radius: 4.5, force: 11.2, lift: 6.0, label: 'BLAZE BURST!', duration: 620 },
    shadow:  { color: 0x9a83ff, radius: 5.0, force: 12.2, lift: 4.2, label: 'SHADOW DASH!', duration: 420, directional: true },
    titan:   { color: 0xffc45c, radius: 4.8, force: 13.2, lift: 6.6, label: 'TITAN QUAKE!', duration: 700 },
    venom:   { color: 0x9bea57, radius: 3.7, force: 9.5, lift: 3.4, label: 'VENOM BLAST!', duration: 650 },
    nova:    { color: 0x62dfff, radius: 4.7, force: 10.8, lift: 5.7, label: 'NOVA PULSE!', duration: 560 },
    frost:   { color: 0x9deaff, radius: 4.0, force: 9.8, lift: 4.8, label: 'FROST BURST!', duration: 600 }
  };
  const style = specialStyles[fighter] || specialStyles.classic;
  const pulse = new THREE.Mesh(new THREE.TorusGeometry(0.82, fighter === 'titan' ? 0.14 : 0.085, 8, 40),
    new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.92 }));
  pulse.rotation.x = Math.PI / 2; pulse.position.set(player.position.x, 0.14, player.position.z); scene.add(pulse);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.82, wireframe: fighter === 'shadow' || fighter === 'nova' }));
  core.position.set(player.position.x, 0.8, player.position.z); scene.add(core);
  const started = performance.now();
  const animatePulse = () => {
    const progress = Math.min(1, (performance.now() - started) / style.duration);
    pulse.scale.setScalar(1 + progress * (style.radius / 0.82));
    (pulse.material as THREE.MeshBasicMaterial).opacity = 0.92 * (1 - progress);
    core.scale.setScalar(1 + progress * (fighter === 'nova' ? 3.4 : 2.2));
    core.rotation.y += 0.08;
    (core.material as THREE.MeshBasicMaterial).opacity = 0.82 * (1 - progress);
    if (progress < 1) requestAnimationFrame(animatePulse);
    else {
      scene.remove(pulse, core); pulse.geometry.dispose(); core.geometry.dispose();
      (pulse.material as THREE.Material).dispose(); (core.material as THREE.Material).dispose();
    }
  };
  requestAnimationFrame(animatePulse);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion).normalize();
  for (const bot of rivals) {
    if (bot.userData.fallen || !bot.visible) continue;
    const dx = bot.position.x - player.position.x, dz = bot.position.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= style.radius || distance <= 0.001) continue;
    const direction = new THREE.Vector3(dx / distance, 0, dz / distance);
    if (style.directional && forward.dot(direction) < 0.25) continue;
    const impulse = (bot.userData.knockback as THREE.Vector3 | undefined) ?? new THREE.Vector3();
    const falloff = 1 - distance / (style.radius * 1.35);
    impulse.x += direction.x * style.force * Math.max(0.55, falloff);
    impulse.z += direction.z * style.force * Math.max(0.55, falloff);
    impulse.y = Math.max(impulse.y, style.lift);
    bot.userData.knockback = impulse;
  }
  playSound('impact'); statusEl.textContent = style.label;
  specialButton.classList.add('pressed'); window.setTimeout(() => specialButton.classList.remove('pressed'), 180);
}
specialButton.addEventListener('pointerdown', useSpecial);
function kick() {
  if (roundOver || gamePaused || customizing) return;
  playSound('kick');
  if (kickTime > 0 || tauntTime > 0 || mockTime > 0) return;
  kickTime = 0.48;
  crowdCheer = Math.max(crowdCheer, 0.65);
  drawArenaScoreboard('HERE COMES A KICK!');
  kickHitDone = false;
  recordAchievementKick();
  if (networkReady) sendNetwork({ type: 'kick', x: player.position.x, z: player.position.z, rotation: player.rotation.y });
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
  const delta = Math.min(clock.getDelta(), 0.04);
  crowdAnimationTime += delta;
  crowdCheer = Math.max(0, crowdCheer - delta * 0.48);
  const cheerPulse = 1 + crowdCheer * 0.9;
  const bodyMatrix = new THREE.Matrix4();
  const bodyPosition = new THREE.Vector3();
  const bodyQuaternion = new THREE.Quaternion();
  const bodyScale = new THREE.Vector3();
  for (let i = 0; i < crowdCount; i++) {
    const bounce = Math.max(0, Math.sin(crowdAnimationTime * (3.2 + (i % 5) * 0.22) + i * 1.7));
    crowdBaseMatrices[i].decompose(bodyPosition, bodyQuaternion, bodyScale);
    bodyPosition.y += bounce * 0.11 * cheerPulse;
    bodyMatrix.compose(bodyPosition, bodyQuaternion, bodyScale);
    crowdBodies.setMatrixAt(i, bodyMatrix);
    crowdHeadBaseMatrices[i].decompose(bodyPosition, bodyQuaternion, bodyScale);
    bodyPosition.y += bounce * 0.13 * cheerPulse;
    bodyMatrix.compose(bodyPosition, bodyQuaternion, bodyScale);
    crowdHeads.setMatrixAt(i, bodyMatrix);
  }
  crowdBodies.instanceMatrix.needsUpdate = true;
  crowdHeads.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < crowdArmBaseMatrices.length; i++) {
    const wave = Math.sin(crowdAnimationTime * 5 + Math.floor(i / 2) * 1.3 + i * 0.7);
    crowdArmBaseMatrices[i].decompose(bodyPosition, bodyQuaternion, bodyScale);
    bodyPosition.y += Math.max(0, wave) * 0.12 * cheerPulse;
    bodyQuaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), wave * 0.16 * cheerPulse));
    bodyMatrix.compose(bodyPosition, bodyQuaternion, bodyScale);
    crowdArms.setMatrixAt(i, bodyMatrix);
  }
  crowdArms.instanceMatrix.needsUpdate = true;
  scoreboardRefresh += delta;
  if (scoreboardRefresh > 2.5 && crowdCheer < 0.05) {
    scoreboardRefresh = 0;
    drawArenaScoreboard(networkReady ? 'ONLINE SHOWDOWN' : trainingMode ? 'PRACTICE ROUND' : 'LIVE MATCH');
  }
  if ((gamePaused && !networkReady) || customizing) { if (customizing && previewPointerId === null) player.rotation.y += delta * 0.22; renderer.render(scene, camera); return; }
  if (!roundOver && !trainingMode && !networkReady) {
    matchTimeRemaining = Math.max(0, matchTimeRemaining - delta);
    matchTimeEl.textContent = formatMatchTime(matchTimeRemaining);
    matchTimeEl.classList.toggle('urgent', matchTimeRemaining <= 30);
    if (matchTimeRemaining <= 0) {
      roundOver = true;
      statusEl.textContent = 'TIME UP';
      matchOverTitle.textContent = 'TIME UP';
      matchOverMessage.textContent = 'That round is over. Ready for another match?';
      recordMatchResult('loss');
      updateMatchResult();
      matchOverEl.hidden = false;
      matchOverEl.setAttribute('aria-hidden', 'false');
    }
  }
  if (roundOver) {
    renderer.render(scene, camera);
    return;
  }
  if (victoryActive) {
    victoryTime += delta;
    player.position.x += (0 - player.position.x) * Math.min(1, delta * 2.8);
    player.position.z += (0 - player.position.z) * Math.min(1, delta * 2.8);
    player.rotation.y += (Math.PI - player.rotation.y) * Math.min(1, delta * 2.5);
    const victoryMotion = fighterMotion[config.fighterId || 'classic'] || fighterMotion.classic;
    const victoryLeftArm = player.userData.leftArm as THREE.Group | THREE.Mesh | undefined;
    const victoryRightArm = player.userData.rightArm as THREE.Group | THREE.Mesh | undefined;
    if (victoryLeftArm) { victoryLeftArm.rotation.z += ((-0.95 * victoryMotion.victory) - victoryLeftArm.rotation.z) * Math.min(1, delta * 3); victoryLeftArm.rotation.x = Math.sin(victoryTime * 3) * 0.12; }
    if (victoryRightArm) { victoryRightArm.rotation.z += ((0.95 * victoryMotion.victory) - victoryRightArm.rotation.z) * Math.min(1, delta * 3); victoryRightArm.rotation.x = -Math.sin(victoryTime * 3) * 0.12; }
    player.rotation.z = Math.sin(victoryTime * 2.4) * 0.035;
    if (victoryTime > 1.65) {
      const rise = Math.min(1, (victoryTime - 1.65) / 2.15);
      const height = 0.035 + (PODIUM_HEIGHT - 0.035) * rise;
      baseTile.scale.y = height / 0.035;
      baseTile.position.y = height / 2 - 0.065;
      player.position.y = height - 0.065;
      if (victoryTime > 4.05) {
        if (!trophy.visible) playSound('victory');
        trophy.visible = true;
        trophy.position.set(0, player.position.y + 3.35 + Math.sin(victoryTime * 3) * 0.08, 0);
        trophy.rotation.y += delta * 0.8;
      }
    }
    camera.position.x += (0 - camera.position.x) * Math.min(1, delta * 1.8);
    camera.position.y += (17 - camera.position.y) * Math.min(1, delta * 1.8);
    camera.position.z += (20 - camera.position.z) * Math.min(1, delta * 1.8);
    camera.lookAt(0, Math.min(PODIUM_HEIGHT, Math.max(0, player.position.y + 1.1)), 0);
    if (victoryTime > 6.15) {
      victoryActive = false;
      roundOver = true;
      statusEl.textContent = 'CHAMPION!';
      matchOverTitle.textContent = 'YOU ARE THE CHAMPION!';
      matchOverMessage.textContent = 'All rivals eliminated. The arena belongs to you!';
      updateMatchResult();
      matchOverEl.hidden = false;
      matchOverEl.setAttribute('aria-hidden', 'false');
    }
    renderer.render(scene, camera);
    return;
  }
  networkSendClock += delta;
  if (networkReady && networkSendClock >= 1 / 30) {
    networkSendClock = 0;
    sendNetwork({ type: 'state', x: player.position.x, z: player.position.z, rotation: player.rotation.y });
  }
  const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const z = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  const inputX = x || moveX, inputZ = z || moveZ, length = Math.hypot(inputX, inputZ) || 1;
  const moving = Math.abs(inputX) + Math.abs(inputZ) > 0.05;
  const playerFallen = Boolean(player.userData.fallen);
  if (!playerFallen) {
    const moveSpeed = speedBoostTime > 0 ? 7.2 : 5;
    player.position.x += inputX / length * moveSpeed * delta;
    player.position.z += inputZ / length * moveSpeed * delta;
    if (Math.hypot(player.position.x, player.position.z) > 8.78) {
      player.userData.fallen = true;
      playSound('fall');
      player.userData.fallVelocity = 0;
      statusEl.textContent = 'YOU FELL INTO THE ABYSS!';
      kickTime = 0; tauntTime = 0; mockTime = 0;
    }
  } else {
    player.userData.fallVelocity = Number(player.userData.fallVelocity || 0) - 18 * delta;
    player.position.y += Number(player.userData.fallVelocity) * delta;
    player.rotation.z += delta * 2.2;
    if (player.position.y < -12 && trainingMode) {
      player.position.set(0, 0, 0);
      player.rotation.set(0, Math.PI, 0);
      player.userData.fallen = false;
      player.userData.fallVelocity = 0;
      player.visible = true;
      moveX = 0; moveZ = 0;
      releaseStick();
      statusEl.textContent = 'TRAINING MODE';
    } else if (player.position.y < -12) {
      player.visible = false;
      if (!roundOver) {
        roundOver = true;
        statusEl.textContent = 'YOU FELL!';
        matchOverTitle.textContent = 'YOU FELL!';
        matchOverMessage.textContent = 'You fell into the abyss. Ready to try again?';
        recordMatchResult('loss');
        updateMatchResult();
        matchOverEl.hidden = false;
        matchOverEl.setAttribute('aria-hidden', 'false');
      }
    }
  }

  // Offline collectible: update a single low-poly pickup and award a temporary speed boost.
  if (!networkReady && !victoryStarted) {
    arenaEventClock += delta;
    if (arenaEventClock >= 35) {
      arenaEventClock = 0;
      const eventRoll = Math.floor(Math.random() * 3);
      if (eventRoll === 0) {
        speedBoostTime = Math.max(speedBoostTime, 8);
        statusEl.textContent = 'ARENA EVENT: SPEED SURGE!';
        powerupStatus.textContent = 'EVENT · SPEED SURGE 8.0s';
      } else if (eventRoll === 1) {
        shieldTime = Math.max(shieldTime, 8);
        statusEl.textContent = 'ARENA EVENT: SHIELD UP!';
        powerupStatus.textContent = 'EVENT · SHIELD 8.0s';
      } else {
        powerKickTime = Math.max(powerKickTime, 8);
        statusEl.textContent = 'ARENA EVENT: POWER KICK!';
        powerupStatus.textContent = 'EVENT · POWER KICK 8.0s';
      }
      playSound('victory');
    }
    specialCooldown = Math.max(0, specialCooldown - delta);
    speedBoostTime = Math.max(0, speedBoostTime - delta);
    shieldTime = Math.max(0, shieldTime - delta);
    powerKickTime = Math.max(0, powerKickTime - delta);
    speedAura.visible = speedBoostTime > 0;
    shieldAura.visible = shieldTime > 0;
    powerKickAura.visible = powerKickTime > 0;
    speedAura.rotation.z += delta * 2.4;
    shieldAura.rotation.y += delta * 0.9;
    powerKickAura.rotation.z -= delta * 2.8;
    const auraPulse = 1 + Math.sin(clock.elapsedTime * 9) * 0.045;
    shieldAura.scale.setScalar(auraPulse);
    speedAura.scale.setScalar(1 + Math.sin(clock.elapsedTime * 12) * 0.08);
    powerKickAura.scale.setScalar(1 + Math.sin(clock.elapsedTime * 14) * 0.1);
    const activeEffect = speedBoostTime > 0 ? `SPEED BOOST ${speedBoostTime.toFixed(1)}s`
      : shieldTime > 0 ? `SHIELD ${shieldTime.toFixed(1)}s`
      : powerKickTime > 0 ? `POWER KICK ${powerKickTime.toFixed(1)}s`
      : specialCooldown > 0 ? `SPECIAL ${Math.ceil(specialCooldown)}s`
      : !powerup.visible && powerupRespawn > 0 ? `NEXT POWER-UP IN ${powerupRespawn.toFixed(1)}s`
      : 'POWER-UP AVAILABLE';
    powerupStatus.textContent = activeEffect;
    if (powerup.visible) {
      powerup.rotation.y += delta * 1.5;
      powerup.position.y = 0.82 + Math.sin(clock.elapsedTime * 2.8) * 0.12;
      if (!player.userData.fallen && Math.hypot(player.position.x - powerup.position.x, player.position.z - powerup.position.z) < 1.05) {
        powerup.visible = false;
        if (nextPowerupKind === 'speed') {
          speedBoostTime = 7; powerupStatus.textContent = 'SPEED BOOST 7.0s'; statusEl.textContent = 'SPEED BOOST!';
        } else if (nextPowerupKind === 'shield') {
          shieldTime = 8; powerupStatus.textContent = 'SHIELD 8.0s'; statusEl.textContent = 'SHIELD ACTIVATED!';
        } else {
          powerKickTime = 8; powerupStatus.textContent = 'POWER KICK 8.0s'; statusEl.textContent = 'POWER KICK ACTIVATED!';
        }
        powerupRespawn = 10; playSound('victory');
      }
    } else if (powerupRespawn > 0) {
      powerupRespawn = Math.max(0, powerupRespawn - delta);
      if (powerupRespawn === 0) {
        const angle = Math.random() * Math.PI * 2, radius = 2.2 + Math.random() * 3.6;
        powerup.position.set(Math.cos(angle) * radius, 0.85, Math.sin(angle) * radius);
        const kinds: PowerupKind[] = ['speed', 'shield', 'power'];
        setPowerupAppearance(kinds[Math.floor(Math.random() * kinds.length)]);
        powerup.visible = true;
      }
    }
  } else { powerup.visible = false; powerupStatus.textContent = networkReady ? 'ONLINE MATCH' : 'MATCH COMPLETE'; }

  // Solo bots fight every active opponent, not just the human player.
  if (!networkReady) rivals.forEach((bot, index) => {
    if (bot.userData.fallen || !bot.visible) return;
    const velocity = (bot.userData.knockback as THREE.Vector3 | undefined) ?? new THREE.Vector3();
    const botAI = (bot.userData.botAI as { cooldown: number; attackTime: number; hitDone: boolean; retargetTime: number; target: THREE.Group | null } | undefined)
      ?? { cooldown: 0.5 + index * 0.31, attackTime: 0, hitDone: false, retargetTime: 0, target: null };
    bot.userData.botAI = botAI;
    botAI.cooldown = Math.max(0, botAI.cooldown - delta);
    botAI.attackTime = Math.max(0, botAI.attackTime - delta);
    botAI.retargetTime = Math.max(0, botAI.retargetTime - delta);

    if (Math.hypot(bot.position.x, bot.position.z) > 8.78) {
      bot.userData.fallen = true;
      velocity.y = Math.min(velocity.y, 0);
      return;
    }

    const targetIsAlive = (candidate: THREE.Group | null) =>
      Boolean(candidate && candidate.visible && !candidate.userData.fallen && candidate.position.y < 1.8);
    if (!targetIsAlive(botAI.target) || (botAI.retargetTime <= 0 && botAI.attackTime <= 0)) {
      let nearest: THREE.Group | null = null;
      let nearestScore = Infinity;
      const candidates = [player, ...rivals.filter(other => other !== bot)];
      for (const candidate of candidates) {
        if (!targetIsAlive(candidate)) continue;
        const distance = Math.hypot(candidate.position.x - bot.position.x, candidate.position.z - bot.position.z);
        // A small per-bot preference prevents the whole roster from dogpiling one target.
        const preference = candidate === player ? 0.35 + (index % 3) * 0.08 : ((index + rivals.indexOf(candidate)) % 3) * 0.12;
        const score = distance + preference;
        if (score < nearestScore) { nearestScore = score; nearest = candidate; }
      }
      botAI.target = nearest;
      botAI.retargetTime = 0.65 + (index % 4) * 0.17;
    }

    const target = botAI.target;
    if (!target) return;
    const dx = target.position.x - bot.position.x;
    const dz = target.position.z - bot.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.001 && bot.position.y < 0.2) {
      bot.rotation.y = Math.atan2(-dx, -dz);
      if (distance > 1.55 && botAI.attackTime <= 0) {
        const speed = index % 3 === 1 ? 2.55 : 2.2;
        bot.position.x += dx / distance * speed * delta;
        bot.position.z += dz / distance * speed * delta;
        const walk = Math.sin(clock.elapsedTime * 9 + index) * 0.38;
        (bot.userData.leftLeg as THREE.Group).rotation.x = walk;
        (bot.userData.kickLeg as THREE.Group).rotation.x = -walk;
      } else if (distance <= 1.95 && botAI.cooldown <= 0 && botAI.attackTime <= 0) {
        botAI.attackTime = 0.52;
        botAI.cooldown = 1.35 + (index % 4) * 0.22;
        botAI.hitDone = false;
      }
    }
    if (botAI.attackTime > 0) {
      const progress = 1 - botAI.attackTime / 0.52;
      const leg = bot.userData.kickLeg as THREE.Group;
      leg.rotation.x = Math.sin(progress * Math.PI) * 1.05;
      if (!botAI.hitDone && progress >= 0.42 && progress <= 0.72) {
        botAI.hitDone = true;
        const currentTarget = botAI.target;
        if (targetIsAlive(currentTarget)) {
          const hitDx = currentTarget!.position.x - bot.position.x;
          const hitDz = currentTarget!.position.z - bot.position.z;
          const hitDistance = Math.hypot(hitDx, hitDz);
          const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(bot.quaternion);
          const towardTarget = new THREE.Vector3(hitDx, 0, hitDz).normalize();
          const targetIsPlayer = currentTarget === player;
          if (hitDistance < 2.15 && facing.dot(towardTarget) > 0.35 && (!targetIsPlayer || shieldTime <= 0)) {
            if (targetIsPlayer) {
              const push = (player.userData.botPush as THREE.Vector3 | undefined) ?? new THREE.Vector3();
              push.x += towardTarget.x * (4.2 + index * 0.2);
              push.z += towardTarget.z * (4.2 + index * 0.2);
              player.userData.botPush = push;
              statusEl.textContent = 'BOT HIT!';
            } else {
              const targetPush = (currentTarget!.userData.knockback as THREE.Vector3 | undefined) ?? new THREE.Vector3();
              targetPush.x += towardTarget.x * (4.8 + index * 0.16);
              targetPush.z += towardTarget.z * (4.8 + index * 0.16);
              targetPush.y = Math.max(targetPush.y, 4.5);
              currentTarget!.userData.knockback = targetPush;
            }
            playSound('impact');
          }
        }
      }
      if (botAI.attackTime <= 0) leg.rotation.x = 0;
    }
  });
  const botPush = (player.userData.botPush as THREE.Vector3 | undefined) ?? new THREE.Vector3();
  player.position.x += botPush.x * delta;
  player.position.z += botPush.z * delta;
  botPush.multiplyScalar(Math.exp(-4.5 * delta));
  if (Math.abs(botPush.x) + Math.abs(botPush.z) < 0.05) botPush.set(0, 0, 0);
  player.userData.botPush = botPush;
  // Alternate legs and counter-swing arms for a grounded walk cycle.
  // Face the actual travel direction. Three.js forward is local -Z, so X needs the opposite sign here.
  if (moving) player.rotation.y = Math.atan2(-inputX, -inputZ);
  const motion = fighterMotion[config.fighterId || 'classic'] || fighterMotion.classic;
  walkTime += delta * (moving ? motion.walkRate : 3);
  const idlePulse = Math.sin(clock.elapsedTime * (2.1 + motion.idle * 0.45)) * 0.012 * motion.idle;
  const stride = moving ? Math.sin(walkTime) * motion.stride : 0;
  const leftLeg = player.userData.leftLeg as THREE.Group;
  const rightLeg = player.userData.kickLeg as THREE.Group;
  const leftArm = player.userData.leftArm as THREE.Mesh;
  const rightArm = player.userData.rightArm as THREE.Mesh;
  if (kickTime <= 0 && tauntTime <= 0 && mockTime <= 0) {
    leftLeg.rotation.x = stride;
    rightLeg.rotation.x = -stride;
  }
  leftArm.rotation.x = moving ? -stride * 0.45 : 0;
  rightArm.rotation.x = moving ? stride * 0.45 : 0;
  if (tauntTime > 0) {
    tauntTime = Math.max(0, tauntTime - delta);
    const phase = 1.35 - tauntTime;
    const wave = Math.sin(phase * 13);
    leftArm.rotation.z = (config.characterType === 'robot' ? 0 : -0.25) - 1.0 - Math.abs(wave) * 0.28;
    rightArm.rotation.z = (config.characterType === 'robot' ? 0 : 0.25) + 1.0 + Math.abs(wave) * 0.28;
    leftArm.rotation.x = wave * 0.35;
    rightArm.rotation.x = -wave * 0.35;
    player.rotation.z = Math.sin(phase * 18) * 0.13;
    player.position.y = Math.abs(Math.sin(phase * 12)) * 0.16;
    if (tauntTime <= 0) {
      leftArm.rotation.z = config.characterType === 'robot' ? 0 : -0.25;
      rightArm.rotation.z = config.characterType === 'robot' ? 0 : 0.25;
      leftArm.rotation.x = 0; rightArm.rotation.x = 0; player.rotation.z = 0;
      statusEl.textContent = 'READY';
    }
  }
  if (mockTime > 0) {
    mockTime = Math.max(0, mockTime - delta);
    const phase = 1.6 - mockTime;
    const laugh = Math.sin(phase * 17);
    // Point at the rival, then lean back and laugh in a playful cartoon taunt.
    rightArm.rotation.x = 1.18 + Math.max(0, laugh) * 0.12;
    rightArm.rotation.z = (config.characterType === 'robot' ? 0 : 0.25) + 0.18;
    leftArm.rotation.x = 0.55 + Math.abs(laugh) * 0.22;
    leftArm.rotation.z = (config.characterType === 'robot' ? 0 : -0.25) - 0.72;
    player.rotation.z = Math.sin(phase * 17) * 0.10;
    player.position.y = Math.abs(Math.sin(phase * 17)) * 0.075;
    if (mockTime <= 0) {
      rightArm.rotation.x = 0; leftArm.rotation.x = 0;
      rightArm.rotation.z = config.characterType === 'robot' ? 0 : 0.25;
      leftArm.rotation.z = config.characterType === 'robot' ? 0 : -0.25;
      player.rotation.z = 0; statusEl.textContent = 'READY';
    }
  }
  if (mockTime <= 0 && tauntTime <= 0 && !player.userData.fallen) player.position.y = moving ? Math.abs(Math.sin(walkTime * 2)) * (0.018 + motion.idle * 0.007) : idlePulse;
  if (kickTime > 0) {
    kickTime = Math.max(0, kickTime - delta);
    const progress = 1 - kickTime / 0.48;
    const swing = Math.sin(progress * Math.PI);
    const kickLeg = player.userData.kickLeg as THREE.Group;
    const kickShin = player.userData.kickShin as THREE.Group;
    const kickMotion = fighterMotion[config.fighterId || 'classic'] || fighterMotion.classic;
    // Each preset has its own kick rhythm and silhouette while sharing the same hit timing.
    kickLeg.rotation.x = swing * kickMotion.kickPower;
    kickShin.rotation.x = -swing * (0.16 + kickMotion.kickPower * 0.06);
    player.rotation.x = -swing * (0.055 + kickMotion.kickPower * 0.014);

    // Register one impact during the forward part of each kick.
    if (!kickHitDone && progress >= 0.32 && progress <= 0.68) {
      kickHitDone = true;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion).normalize();
      let landedHit = false;
      if (!networkReady) rivals.forEach((rival) => {
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
            const kickForce = powerKickTime > 0 ? 12.5 : 8.5;
            impulse.x += towardRival.x * kickForce;
            impulse.z += towardRival.z * kickForce;
            impulse.y = Math.max(impulse.y, powerKickTime > 0 ? 6.2 : 4.8);
            rival.userData.knockback = impulse;
            landedHit = true;
          }
        }
      });
      if (landedHit) { statusEl.textContent = 'HIT!'; playSound('impact'); }
    }

    if (kickTime <= 0) {
      kickLeg.rotation.x = 0;
      kickShin.rotation.x = 0;
      player.rotation.x = 0;
      statusEl.textContent = 'READY';
    }
  }
  // Fighter-specific body choreography makes each special move readable even without its VFX.
  if (specialTime > 0) {
    specialTime = Math.max(0, specialTime - delta);
    const progress = 1 - specialTime / 0.78;
    const hit = Math.sin(Math.min(1, progress * 1.18) * Math.PI);
    const release = Math.sin(Math.max(0, (progress - 0.28) / 0.72) * Math.PI);
    const robot = config.characterType === 'robot';
    const neutralLeft = robot ? 0 : -0.25;
    const neutralRight = robot ? 0 : 0.25;
    leftArm.rotation.x = 0;
    rightArm.rotation.x = 0;
    leftArm.rotation.z = neutralLeft;
    rightArm.rotation.z = neutralRight;
    leftLeg.rotation.x = 0;
    rightLeg.rotation.x = 0;
    player.rotation.x = 0;
    player.rotation.z = 0;
    if (specialFighter === 'blaze') {
      player.rotation.x = -0.22 * hit;
      leftArm.rotation.z = neutralLeft - 0.95 * hit;
      rightArm.rotation.z = neutralRight + 0.95 * hit;
      leftArm.rotation.x = -0.45 * release; rightArm.rotation.x = -0.45 * release;
      player.position.y = hit * 0.12;
    } else if (specialFighter === 'shadow') {
      player.rotation.x = 0.38 * hit;
      player.rotation.z = -0.12 * hit;
      rightArm.rotation.x = -1.25 * hit;
      leftArm.rotation.x = 0.75 * hit;
      rightArm.rotation.z = neutralRight + 0.28 * hit;
      leftArm.rotation.z = neutralLeft - 0.22 * hit;
      rightLeg.rotation.x = -0.72 * hit; leftLeg.rotation.x = 0.38 * hit;
      player.position.y = hit * 0.045;
    } else if (specialFighter === 'titan') {
      player.rotation.x = -0.3 * hit;
      leftArm.rotation.x = 0.72 * hit; rightArm.rotation.x = 0.72 * hit;
      leftArm.rotation.z = neutralLeft - 0.82 * hit;
      rightArm.rotation.z = neutralRight + 0.82 * hit;
      leftLeg.rotation.x = -0.42 * hit; rightLeg.rotation.x = -0.42 * hit;
      player.position.y = -0.14 * hit;
    } else if (specialFighter === 'venom') {
      player.rotation.z = Math.sin(progress * Math.PI * 2) * 0.2 * hit;
      leftArm.rotation.x = 0.9 * hit; rightArm.rotation.x = 0.9 * hit;
      leftArm.rotation.z = neutralLeft - 0.48 * hit;
      rightArm.rotation.z = neutralRight + 0.48 * hit;
      player.position.y = Math.abs(Math.sin(progress * Math.PI * 3)) * 0.06;
    } else if (specialFighter === 'nova') {
      leftArm.rotation.z = neutralLeft - 1.35 * hit;
      rightArm.rotation.z = neutralRight + 1.35 * hit;
      leftArm.rotation.x = -0.32 * hit; rightArm.rotation.x = -0.32 * hit;
      player.rotation.x = -0.12 * hit;
      player.position.y = 0.16 * hit;
    } else if (specialFighter === 'frost') {
      leftArm.rotation.z = neutralLeft - 0.72 * hit;
      rightArm.rotation.z = neutralRight + 0.72 * hit;
      leftArm.rotation.x = 0.58 * hit; rightArm.rotation.x = 0.58 * hit;
      player.rotation.x = 0.16 * hit;
      player.position.y = 0.035 * hit;
    } else {
      leftArm.rotation.z = neutralLeft - 0.85 * hit;
      rightArm.rotation.z = neutralRight + 0.85 * hit;
      leftArm.rotation.x = -0.2 * hit; rightArm.rotation.x = -0.2 * hit;
      player.rotation.x = -0.12 * hit;
      player.position.y = 0.07 * hit;
    }
    if (specialTime <= 0) {
      leftArm.rotation.x = 0; rightArm.rotation.x = 0;
      leftArm.rotation.z = neutralLeft; rightArm.rotation.z = neutralRight;
      leftLeg.rotation.x = 0; rightLeg.rotation.x = 0;
      player.rotation.x = 0; player.rotation.z = 0; player.position.y = 0;
      statusEl.textContent = 'READY';
    }
  }
  remotePlayers.forEach(remote => {
    remote.mesh.position.x += (remote.targetX - remote.mesh.position.x) * Math.min(1, delta * 14);
    remote.mesh.position.z += (remote.targetZ - remote.mesh.position.z) * Math.min(1, delta * 14);
    const rotationDelta = Math.atan2(Math.sin(remote.targetRotation - remote.mesh.rotation.y), Math.cos(remote.targetRotation - remote.mesh.rotation.y));
    remote.mesh.rotation.y += rotationDelta * Math.min(1, delta * 16);
    // Snap only when a packet gap is large enough to indicate a teleport/rejoin.
    if (Math.hypot(remote.targetX - remote.mesh.position.x, remote.targetZ - remote.mesh.position.z) > 4) {
      remote.mesh.position.x = remote.targetX;
      remote.mesh.position.z = remote.targetZ;
    }
    const remoteTaunt = Number(remote.mesh.userData.remoteTauntTime || 0);
    if (remoteTaunt > 0) {
      remote.mesh.userData.remoteTauntTime = Math.max(0, remoteTaunt - delta);
      const phase = 1.35 - remoteTaunt;
      const wave = Math.sin(phase * 13);
      const la = remote.mesh.userData.leftArm as THREE.Object3D;
      const ra = remote.mesh.userData.rightArm as THREE.Object3D;
      if (la && ra) {
        la.rotation.z = (remote.mesh.userData.remoteRobot ? 0 : -0.25) - 1.0 - Math.abs(wave) * 0.28;
        ra.rotation.z = (remote.mesh.userData.remoteRobot ? 0 : 0.25) + 1.0 + Math.abs(wave) * 0.28;
        la.rotation.x = wave * 0.35; ra.rotation.x = -wave * 0.35;
      }
      remote.mesh.rotation.z = Math.sin(phase * 18) * 0.13;
      remote.mesh.position.y = Math.abs(Math.sin(phase * 12)) * 0.16;
    } else {
      const la = remote.mesh.userData.leftArm as THREE.Object3D;
      const ra = remote.mesh.userData.rightArm as THREE.Object3D;
      if (la && ra) {
        la.rotation.z = remote.mesh.userData.remoteRobot ? 0 : -0.25;
        ra.rotation.z = remote.mesh.userData.remoteRobot ? 0 : 0.25;
        la.rotation.x = 0; ra.rotation.x = 0;
      }
      remote.mesh.rotation.z = 0; remote.mesh.position.y = 0;
    }
    const remoteMock = Number(remote.mesh.userData.remoteMockTime || 0);
    if (remoteMock > 0) {
      remote.mesh.userData.remoteMockTime = Math.max(0, remoteMock - delta);
      const phase = 1.6 - remoteMock;
      const laugh = Math.sin(phase * 17);
      const la = remote.mesh.userData.leftArm as THREE.Object3D;
      const ra = remote.mesh.userData.rightArm as THREE.Object3D;
      if (la && ra) {
        ra.rotation.x = 1.18 + Math.max(0, laugh) * 0.12;
        ra.rotation.z = (remote.mesh.userData.remoteRobot ? 0 : 0.25) + 0.18;
        la.rotation.x = 0.55 + Math.abs(laugh) * 0.22;
        la.rotation.z = (remote.mesh.userData.remoteRobot ? 0 : -0.25) - 0.72;
      }
      remote.mesh.rotation.z = Math.sin(phase * 17) * 0.10;
      remote.mesh.position.y = Math.abs(Math.sin(phase * 17)) * 0.075;
      if (remote.mesh.userData.remoteMockTime === 0) {
        if (la && ra) {
          la.rotation.x = 0; ra.rotation.x = 0;
          la.rotation.z = remote.mesh.userData.remoteRobot ? 0 : -0.25;
          ra.rotation.z = remote.mesh.userData.remoteRobot ? 0 : 0.25;
        }
        remote.mesh.rotation.z = 0; remote.mesh.position.y = 0;
      }
    }
    const remoteKick = Number(remote.mesh.userData.remoteKickTime || 0);
    if (remoteKick > 0) {
      remote.mesh.userData.remoteKickTime = Math.max(0, remoteKick - delta);
      const leg = remote.mesh.userData.kickLeg as THREE.Group;
      leg.rotation.x = Math.sin((1 - remoteKick / 0.48) * Math.PI) * 0.9;
    } else { (remote.mesh.userData.kickLeg as THREE.Group).rotation.x = 0; }
  });
  if (!networkReady) rivals.forEach((rival, i) => {
    const velocity = (rival.userData.knockback as THREE.Vector3 | undefined) ?? new THREE.Vector3();
    velocity.y -= (rival.userData.fallen ? 18 : 13) * delta;
    rival.position.addScaledVector(velocity, delta);
    const drag = Math.exp(-2.4 * delta);
    velocity.x *= drag;
    velocity.z *= drag;
    if (rival.userData.fallen) {
      if (rival.position.y < -12) rival.visible = false;
      rival.userData.knockback = velocity;
      return;
    }
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
    // Bot facing is controlled by its chase AI above.
  });
  // Victory begins only after every solo rival has completed its fall and disappeared.
  if (!networkReady && !victoryStarted && rivals.every(rival => Boolean(rival.userData.fallen) && !rival.visible)) {
    beginVictory();
  }
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
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(getQualityPixelRatio()); if (customizing) frameCharacterPreview(); });
