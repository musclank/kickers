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

type AvatarConfig = {
  skin: string; outfit: string; shoes: string; hairColor: string; hairStyle: string; accessory: string;
  bodyWidth: number; bodyHeight: number; headSize: number; legLength: number;
};
const defaults: AvatarConfig = {
  skin: '#4de2d0', outfit: '#ffb84d', shoes: '#24243a', hairColor: '#26314d', hairStyle: 'smooth',
  accessory: 'none', bodyWidth: 1, bodyHeight: 1, headSize: 1, legLength: 1
};
let config: AvatarConfig = { ...defaults };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10152b);
scene.fog = new THREE.Fog(0x10152b, 18, 42);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 11, 15);
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
const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.7, 64), new THREE.MeshStandardMaterial({ color: 0x303b62, roughness: 0.85 }));
floor.position.y = -0.45; floor.receiveShadow = true; scene.add(floor);
const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.22, 12, 80), new THREE.MeshStandardMaterial({ color: 0xffc857, metalness: 0.35, roughness: 0.45 }));
rim.rotation.x = Math.PI / 2; rim.position.y = -0.05; scene.add(rim);
const grid = new THREE.GridHelper(17, 17, 0x7184b8, 0x46527c); grid.position.y = -0.08; scene.add(grid);

// Official Base brand mark on the arena floor.
// Assets are sourced from Base's public brand kit and kept in their original colors.
const baseTextureLoader = new THREE.TextureLoader();
baseTextureLoader.load('/base-square-blue.svg', (texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  const tile = new THREE.Mesh(
    new THREE.PlaneGeometry(3.7, 3.7),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  tile.rotation.x = -Math.PI / 2;
  tile.position.set(0, -0.082, 0);
  tile.renderOrder = 2;
  scene.add(tile);
});
baseTextureLoader.load('/base-basemark-white.svg', (texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(2.85, 0.93),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(0, -0.068, 0);
  mark.renderOrder = 3;
  scene.add(mark);
});

function material(color: string) { return new THREE.MeshStandardMaterial({ color, roughness: 0.68 }); }
function addMesh(parent: THREE.Group, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function makeAvatar(cfg: AvatarConfig, x: number, z: number) {
  const group = new THREE.Group();
  const bodyY = 0.85 * cfg.bodyHeight;
  addMesh(group, new THREE.CapsuleGeometry(0.48 * cfg.bodyWidth, 0.55 * cfg.bodyHeight, 6, 12), cfg.outfit, 0, bodyY, 0);
  addMesh(group, new THREE.SphereGeometry(0.39 * cfg.headSize, 20, 16), cfg.skin, 0, bodyY + 0.82 * cfg.headSize, 0);
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
  leftLeg.position.set(-0.22 * cfg.bodyWidth, 0.48 * legScale, 0);
  addMesh(leftLeg, new THREE.CapsuleGeometry(0.15, 0.28 * legScale, 4, 8), cfg.skin, 0, -0.16 * legScale, 0);
  addMesh(leftLeg, new THREE.BoxGeometry(0.34, 0.2, 0.5), cfg.shoes, 0, -0.34 * legScale, -0.13);
  group.add(leftLeg);

  const kickLeg = new THREE.Group();
  kickLeg.position.set(0.22 * cfg.bodyWidth, 0.48 * legScale, 0);
  addMesh(kickLeg, new THREE.CapsuleGeometry(0.15, 0.28 * legScale, 4, 8), cfg.skin, 0, -0.16 * legScale, 0);
  const knee = addMesh(kickLeg, new THREE.SphereGeometry(0.15, 12, 10), cfg.skin, 0, -0.29 * legScale, 0);
  const shin = new THREE.Group();
  shin.position.set(0, -0.29 * legScale, 0);
  addMesh(shin, new THREE.CapsuleGeometry(0.13, 0.25 * legScale, 4, 8), cfg.skin, 0, -0.13 * legScale, 0);
  addMesh(shin, new THREE.BoxGeometry(0.36, 0.2, 0.54), cfg.shoes, 0, -0.29 * legScale, -0.16);
  kickLeg.add(shin);
  group.add(kickLeg);
  group.userData.kickLeg = kickLeg;
  group.userData.kickShin = shin;
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
function rebuildPlayer() {
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
    rebuildPlayer();
    for (const id of ['skin-color','outfit-color','shoe-color','hair-color']) (document.querySelector<HTMLInputElement>('#'+id)!).value = String(config[id === 'skin-color' ? 'skin' : id === 'outfit-color' ? 'outfit' : id === 'shoe-color' ? 'shoes' : 'hairColor']);
    for (const id of ['hair-style','accessory']) (document.querySelector<HTMLSelectElement>('#'+id)!).value = String(config[id === 'hair-style' ? 'hairStyle' : 'accessory']);
    for (const [id,key] of [['body-width','bodyWidth'],['body-height','bodyHeight'],['head-size','headSize'],['leg-length','legLength']] as const) {
      const el = document.querySelector<HTMLInputElement>('#'+id)!; el.value = String(config[key]);
      (document.querySelector<HTMLOutputElement>('#'+id+'-value')!).value = Number(config[key]).toFixed(1);
    }
  }
} catch { /* Ignore an invalid local saved design. */ }

let moveX = 0, moveZ = 0, kickTime = 0;
const keys = new Set<string>();
const clock = new THREE.Clock();
addEventListener('keydown', (event) => { keys.add(event.key.toLowerCase()); if (event.code === 'Space') { event.preventDefault(); kick(); } });
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
function kick() {
  if (kickTime > 0) return;
  kickTime = 0.48;
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
  const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const z = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  const inputX = x || moveX, inputZ = z || moveZ, length = Math.hypot(inputX, inputZ) || 1;
  player.position.x = THREE.MathUtils.clamp(player.position.x + inputX / length * 5 * delta, -8, 8);
  player.position.z = THREE.MathUtils.clamp(player.position.z + inputZ / length * 5 * delta, -8, 8);
  // Avatar's face points along local -Z, so rotate toward the actual movement vector.
  if (Math.abs(inputX) + Math.abs(inputZ) > 0.05) player.rotation.y = Math.atan2(inputX, -inputZ);
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
    if (kickTime <= 0) {
      kickLeg.rotation.x = 0;
      kickShin.rotation.x = 0;
      player.rotation.x = 0;
      statusEl.textContent = 'READY';
    }
  }
  rivals.forEach((rival, i) => { rival.position.y = Math.sin(clock.elapsedTime * 2 + i) * 0.06; rival.rotation.y += delta * (i % 2 ? 0.35 : -0.3); });
  camera.position.x += (player.position.x * 0.22 - camera.position.x) * 0.04;
  camera.lookAt(player.position.x * 0.15, 0, 0);
  renderer.render(scene, camera);
}
animate();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); });
