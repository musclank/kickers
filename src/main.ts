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
  characterType: 'human' | 'robot'; skin: string; outfit: string; shoes: string; hairColor: string; hairStyle: string; accessory: string;
  bodyWidth: number; bodyHeight: number; headSize: number; legLength: number; shirtImage?: string; fighterId?: string;
};
const defaults: AvatarConfig = {
  characterType: 'human', skin: '#4de2d0', outfit: '#ffb84d', shoes: '#24243a', hairColor: '#26314d', hairStyle: 'smooth',
  accessory: 'none', bodyWidth: 1, bodyHeight: 1, headSize: 1, legLength: 1, fighterId: 'classic'
};
const fighterPresets: Record<string, AvatarConfig> = {
  classic: { ...defaults, fighterId: 'classic' },
  blaze: { ...defaults, fighterId: 'blaze', skin: '#d98b62', outfit: '#c93632', shoes: '#24202b', hairColor: '#f3a33c', hairStyle: 'spiky', accessory: 'none', bodyWidth: 1.16, bodyHeight: 1.08, headSize: 0.96, legLength: 1.05 },
  shadow: { ...defaults, fighterId: 'shadow', skin: '#b6b9d2', outfit: '#242b49', shoes: '#101522', hairColor: '#121827', hairStyle: 'none', accessory: 'glasses', bodyWidth: 0.84, bodyHeight: 1.12, headSize: 0.94, legLength: 1.22 },
  titan: { ...defaults, fighterId: 'titan', skin: '#8cbd82', outfit: '#65717e', shoes: '#303945', hairColor: '#303945', hairStyle: 'none', accessory: 'none', bodyWidth: 1.42, bodyHeight: 1.22, headSize: 0.88, legLength: 0.86 },
  venom: { ...defaults, fighterId: 'venom', skin: '#b7e0d2', outfit: '#56318a', shoes: '#1c1830', hairColor: '#251b38', hairStyle: 'none', accessory: 'horns', bodyWidth: 1.02, bodyHeight: 1.02, headSize: 1.18, legLength: 1.02 },
  nova: { ...defaults, fighterId: 'nova', skin: '#e5b7a3', outfit: '#167e9a', shoes: '#d5e8f0', hairColor: '#e8f2ff', hairStyle: 'smooth', accessory: 'crown', bodyWidth: 0.94, bodyHeight: 1.08, headSize: 1.08, legLength: 1.12 },
  frost: { ...defaults, fighterId: 'frost', skin: '#a6c9e8', outfit: '#dce9f4', shoes: '#536c91', hairColor: '#80bde9', hairStyle: 'spiky', accessory: 'none', bodyWidth: 0.98, bodyHeight: 1.16, headSize: 0.98, legLength: 1.08 }
};
let config: AvatarConfig = { ...defaults };
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
  makeAvatar({ ...defaults, skin: '#9b83ff', outfit: '#3d725f', accessory: 'crown' }, 1, -6)
];
rivals.forEach((bot, index) => setNameLabel(bot, `BOT 0${index + 1}`));

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
  playerCountText.textContent = `${players.length}/4 PLAYERS`;
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
    playerCountText.textContent = '1/4 PLAYERS';
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
    'hair-style': config.hairStyle, 'accessory': config.accessory
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
  try { localStorage.setItem('kickers-avatar-v1', JSON.stringify(config)); } catch { /* selection remains active for this session */ }
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
    statusEl.textContent = networkReady ? 'ONLINE' : (gamePaused ? 'PAUSED' : 'READY');
  }
}
creatorToggle.addEventListener('click', () => setCustomizationOpen(!customizing));
saveButton.addEventListener('click', () => {
  try { localStorage.setItem('kickers-avatar-v1', JSON.stringify(config)); savedLabel.textContent = 'CHARACTER SAVED ON THIS DEVICE'; }
  catch { savedLabel.textContent = 'SAVE NOT AVAILABLE'; }
});
try {
  const saved = localStorage.getItem('kickers-avatar-v1');
  if (saved) {
    config = { ...defaults, ...JSON.parse(saved) as Partial<AvatarConfig> };
    characterTypeInput.value = config.characterType;
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
const activeFighterId = config.fighterId || 'classic';
fighterCards.forEach(card => {
  const selected = card.dataset.fighter === activeFighterId;
  card.classList.toggle('selected', selected);
  card.setAttribute('aria-pressed', String(selected));
});
const selectedFighterLabel = document.querySelector<HTMLElement>('#selected-fighter-name');
if (selectedFighterLabel) selectedFighterLabel.textContent = activeFighterId.toUpperCase();

let moveX = 0, moveZ = 0, kickTime = 0, tauntTime = 0, mockTime = 0, walkTime = 0, kickHitDone = false;
let speedBoostTime = 0, shieldTime = 0, powerKickTime = 0, specialCooldown = 0, powerupRespawn = 0;
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
  if (roundOver || gamePaused || customizing) return;
  if (networkReady) { setOnlineMessage('SPECIAL MOVES ARE CURRENTLY OFFLINE-ONLY'); return; }
  if (specialCooldown > 0) return;
  if (kickTime > 0 || tauntTime > 0 || mockTime > 0) return;
  specialCooldown = 12;
  const pulse = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.09, 8, 36), new THREE.MeshBasicMaterial({ color: 0x65e7d9, transparent: true, opacity: 0.9 }));
  pulse.rotation.x = Math.PI / 2; pulse.position.set(player.position.x, 0.12, player.position.z); scene.add(pulse);
  const started = performance.now();
  const animatePulse = () => {
    const progress = Math.min(1, (performance.now() - started) / 520);
    pulse.scale.setScalar(1 + progress * 4.2); (pulse.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - progress);
    if (progress < 1) requestAnimationFrame(animatePulse);
    else { scene.remove(pulse); pulse.geometry.dispose(); (pulse.material as THREE.Material).dispose(); }
  };
  requestAnimationFrame(animatePulse);
  for (const bot of rivals) {
    if (bot.userData.fallen || !bot.visible) continue;
    const dx = bot.position.x - player.position.x, dz = bot.position.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 4.2 && distance > 0.001) {
      const impulse = (bot.userData.knockback as THREE.Vector3 | undefined) ?? new THREE.Vector3();
      impulse.x += dx / distance * 10; impulse.z += dz / distance * 10; impulse.y = Math.max(impulse.y, 5.2);
      bot.userData.knockback = impulse;
    }
  }
  playSound('impact'); statusEl.textContent = 'SHOCKWAVE!';
  specialButton.classList.add('pressed'); window.setTimeout(() => specialButton.classList.remove('pressed'), 180);
}
specialButton.addEventListener('pointerdown', useSpecial);
function kick() {
  if (roundOver || gamePaused || customizing) return;
  playSound('kick');
  if (kickTime > 0 || tauntTime > 0 || mockTime > 0) return;
  kickTime = 0.48;
  kickHitDone = false;
  recordAchievementKick();
  if (networkReady) sendNetwork({ type: 'kick' });
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
  if ((gamePaused && !networkReady) || customizing) { renderer.render(scene, camera); return; }
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
  if (networkReady && networkSendClock >= 0.05) {
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

  // Solo arena bots actively hunt the player, close the distance, and launch timed kicks.
  if (!networkReady) rivals.forEach((bot, index) => {
    if (bot.userData.fallen) return;
    const velocity = (bot.userData.knockback as THREE.Vector3 | undefined) ?? new THREE.Vector3();
    const botAI = (bot.userData.botAI as { cooldown: number; attackTime: number; hitDone: boolean } | undefined)
      ?? { cooldown: 0.5 + index * 0.55, attackTime: 0, hitDone: false };
    bot.userData.botAI = botAI;
    botAI.cooldown = Math.max(0, botAI.cooldown - delta);
    botAI.attackTime = Math.max(0, botAI.attackTime - delta);
    const dx = player.position.x - bot.position.x;
    const dz = player.position.z - bot.position.z;
    const distance = Math.hypot(dx, dz);
    if (Math.hypot(bot.position.x, bot.position.z) > 8.78 && !bot.userData.fallen) {
      bot.userData.fallen = true;
      velocity.y = Math.min(velocity.y, 0);
    }
    if (bot.userData.fallen) return;
    if (distance > 0.001 && bot.position.y < 0.2) {
      bot.rotation.y = Math.atan2(-dx, -dz);
      if (distance > 1.55 && botAI.attackTime <= 0) {
        const speed = index === 1 ? 2.65 : 2.25;
        bot.position.x += dx / distance * speed * delta;
        bot.position.z += dz / distance * speed * delta;
        const walk = Math.sin(clock.elapsedTime * 9 + index) * 0.38;
        (bot.userData.leftLeg as THREE.Group).rotation.x = walk;
        (bot.userData.kickLeg as THREE.Group).rotation.x = -walk;
      } else if (distance <= 1.95 && botAI.cooldown <= 0 && botAI.attackTime <= 0) {
        botAI.attackTime = 0.52;
        botAI.cooldown = 1.65 + index * 0.28;
        botAI.hitDone = false;
      }
    }
    if (botAI.attackTime > 0) {
      const progress = 1 - botAI.attackTime / 0.52;
      const leg = bot.userData.kickLeg as THREE.Group;
      leg.rotation.x = Math.sin(progress * Math.PI) * 1.05;
      if (!botAI.hitDone && progress >= 0.42 && progress <= 0.72) {
        botAI.hitDone = true;
        const hitDx = player.position.x - bot.position.x;
        const hitDz = player.position.z - bot.position.z;
        const hitDistance = Math.hypot(hitDx, hitDz);
        const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(bot.quaternion);
        const towardPlayer = new THREE.Vector3(hitDx, 0, hitDz).normalize();
        if (hitDistance < 2.15 && facing.dot(towardPlayer) > 0.35 && shieldTime <= 0) {
          const push = (player.userData.botPush as THREE.Vector3 | undefined) ?? new THREE.Vector3();
          push.x += towardPlayer.x * (4.2 + index * 0.35);
          push.z += towardPlayer.z * (4.2 + index * 0.35);
          player.userData.botPush = push;
          statusEl.textContent = 'BOT HIT!';
          playSound('impact');
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
  walkTime += delta * (moving ? 10 : 3);
  const stride = moving ? Math.sin(walkTime) * 0.48 : 0;
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
  if (mockTime <= 0 && tauntTime <= 0 && !player.userData.fallen) player.position.y = moving ? Math.abs(Math.sin(walkTime * 2)) * 0.025 : 0;
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
  remotePlayers.forEach(remote => {
    remote.mesh.position.x += (remote.targetX - remote.mesh.position.x) * Math.min(1, delta * 14);
    remote.mesh.position.z += (remote.targetZ - remote.mesh.position.z) * Math.min(1, delta * 14);
    remote.mesh.rotation.y += (remote.targetRotation - remote.mesh.rotation.y) * Math.min(1, delta * 12);
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
