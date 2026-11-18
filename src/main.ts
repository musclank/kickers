import * as THREE from 'three';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const statusEl = document.querySelector<HTMLSpanElement>('#status')!;
const kickButton = document.querySelector<HTMLButtonElement>('#kick')!;
const joystick = document.querySelector<HTMLDivElement>('#joystick')!;
const stick = document.querySelector<HTMLDivElement>('#stick')!;

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
sun.position.set(-5, 12, 7);
sun.castShadow = true;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(9, 9, 0.7, 64),
  new THREE.MeshStandardMaterial({ color: 0x303b62, roughness: 0.85 })
);
floor.position.y = -0.45;
floor.receiveShadow = true;
scene.add(floor);

const rim = new THREE.Mesh(
  new THREE.TorusGeometry(9, 0.22, 12, 80),
  new THREE.MeshStandardMaterial({ color: 0xffc857, metalness: 0.35, roughness: 0.45 })
);
rim.rotation.x = Math.PI / 2;
rim.position.y = -0.05;
scene.add(rim);

const grid = new THREE.GridHelper(17, 17, 0x7184b8, 0x46527c);
grid.position.y = -0.08;
scene.add(grid);

function makeFighter(color: number, x: number, z: number) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 0.75, 6, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
  );
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x17172a })
  );
  face.position.set(0.2, 1.15, -0.47);
  group.add(face);

  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.24, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x17172a })
  );
  foot.position.set(0.18, 0.22, -0.48);
  foot.castShadow = true;
  group.add(foot);

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

const player = makeFighter(0x4de2d0, 0, 2);
const rivals = [
  makeFighter(0xff6b78, -4, -2),
  makeFighter(0xffc857, 4, -3),
  makeFighter(0x9b83ff, 1, -6)
];

let moveX = 0;
let moveZ = 0;
let kickTime = 0;
const keys = new Set<string>();
const clock = new THREE.Clock();

addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
  if (event.code === 'Space') { event.preventDefault(); kick(); }
});
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

function kick() {
  if (kickTime > 0) return;
  kickTime = 0.32;
  statusEl.textContent = 'KICK!';
  kickButton.classList.add('pressed');
  setTimeout(() => kickButton.classList.remove('pressed'), 140);
}

kickButton.addEventListener('pointerdown', kick);

let pointerId: number | null = null;
let joyCenter = { x: 0, y: 0 };
joystick.addEventListener('pointerdown', (event) => {
  pointerId = event.pointerId;
  joystick.setPointerCapture(pointerId);
  const rect = joystick.getBoundingClientRect();
  joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  updateStick(event.clientX, event.clientY);
});
joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId === pointerId) updateStick(event.clientX, event.clientY);
});
function updateStick(x: number, y: number) {
  const dx = x - joyCenter.x;
  const dy = y - joyCenter.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const scale = Math.min(1, 42 / length);
  moveX = (dx * scale) / 42;
  moveZ = (dy * scale) / 42;
  stick.style.transform = `translate(${moveX * 42}px, ${moveZ * 42}px)`;
}
function releaseStick() {
  pointerId = null;
  moveX = 0;
  moveZ = 0;
  stick.style.transform = 'translate(0, 0)';
}
joystick.addEventListener('pointerup', releaseStick);
joystick.addEventListener('pointercancel', releaseStick);

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);
  const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const z = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  const inputX = x || moveX;
  const inputZ = z || moveZ;
  const length = Math.hypot(inputX, inputZ) || 1;
  player.position.x += (inputX / length) * 5 * delta;
  player.position.z += (inputZ / length) * 5 * delta;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -8, 8);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -8, 8);
  if (Math.abs(inputX) + Math.abs(inputZ) > 0.05) {
    player.rotation.y = Math.atan2(inputX, inputZ);
  }
  if (kickTime > 0) {
    kickTime -= delta;
    player.scale.z = 1 + Math.sin((0.32 - kickTime) / 0.32 * Math.PI) * 0.28;
    if (kickTime <= 0) { player.scale.z = 1; statusEl.textContent = 'READY'; }
  }
  rivals.forEach((rival, i) => {
    rival.position.y = Math.sin(clock.elapsedTime * 2 + i) * 0.06;
    rival.rotation.y += delta * (i % 2 ? 0.35 : -0.3);
  });
  camera.position.x += (player.position.x * 0.22 - camera.position.x) * 0.04;
  camera.lookAt(player.position.x * 0.15, 0, 0);
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});
