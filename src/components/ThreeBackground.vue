<template>
  <div ref="canvasContainer" class="three-background-container" aria-hidden="true"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';

const props = defineProps({
  theme: {
    type: String,
    default: 'dark'
  }
});

const canvasContainer = ref(null);

let scene, camera, renderer, animationFrameId;
let waveMesh, particleSystem, light1, light2, light3, ambientLight;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;
let planeGeometry;

const themePalettes = {
  dark: {
    bg: 0x040711,
    fog: 0x040711,
    wireframe: 0x00f2fe,
    wireframeOpacity: 0.35,
    particles: [0x00f2fe, 0x7000ff, 0x00c8ff, 0x38bdf8],
    light1: 0x00f2fe,
    light2: 0x9d4edd,
    light3: 0x3a86ff,
    ambient: 0x0a1128
  },
  light: {
    bg: 0xf8fafc,
    fog: 0xf8fafc,
    wireframe: 0x3b82f6,
    wireframeOpacity: 0.22,
    particles: [0x2563eb, 0x8b5cf6, 0x06b6d4, 0x10b981],
    light1: 0x60a5fa,
    light2: 0xc084fc,
    light3: 0x34d399,
    ambient: 0xf1f5f9
  }
};

const initThree = () => {
  if (!canvasContainer.value) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  // 1. Scene
  scene = new THREE.Scene();
  const colors = themePalettes[props.theme] || themePalettes.dark;
  scene.background = new THREE.Color(colors.bg);
  scene.fog = new THREE.FogExp2(colors.fog, 0.012);

  // 2. Camera
  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
  camera.position.set(0, 18, 45);
  camera.lookAt(0, 0, 0);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasContainer.value.appendChild(renderer.domElement);

  // 4. Lights
  ambientLight = new THREE.AmbientLight(colors.ambient, 2);
  scene.add(ambientLight);

  light1 = new THREE.PointLight(colors.light1, 6, 120);
  light1.position.set(30, 25, 20);
  scene.add(light1);

  light2 = new THREE.PointLight(colors.light2, 5, 120);
  light2.position.set(-30, -10, -10);
  scene.add(light2);

  light3 = new THREE.PointLight(colors.light3, 4, 100);
  light3.position.set(0, 30, -30);
  scene.add(light3);

  // 5. Dynamic Organic Wave Mesh (Cyber Landscape)
  const isMobile = width < 768;
  const segmentsX = isMobile ? 45 : 75;
  const segmentsY = isMobile ? 45 : 75;

  planeGeometry = new THREE.PlaneGeometry(120, 120, segmentsX, segmentsY);
  planeGeometry.rotateX(-Math.PI / 2.3);

  const planeMaterial = new THREE.MeshPhongMaterial({
    color: colors.wireframe,
    wireframe: true,
    transparent: true,
    opacity: colors.wireframeOpacity,
    shininess: 90,
    side: THREE.DoubleSide
  });

  waveMesh = new THREE.Mesh(planeGeometry, planeMaterial);
  waveMesh.position.set(0, -12, -10);
  scene.add(waveMesh);

  // 6. Floating Bokeh Particle Cloud
  const particleCount = isMobile ? 200 : 450;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const particleScales = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 140;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 70 + 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 120;

    const colorHex = colors.particles[i % colors.particles.length];
    const c = new THREE.Color(colorHex);
    particleColors[i * 3] = c.r;
    particleColors[i * 3 + 1] = c.g;
    particleColors[i * 3 + 2] = c.b;

    particleScales[i] = Math.random() * 1.5 + 0.5;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

  const particleMaterial = new THREE.PointsMaterial({
    size: isMobile ? 1.0 : 1.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  particleSystem = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particleSystem);

  // Event Listeners
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('resize', onWindowResize);

  animate();
};

const onMouseMove = (event) => {
  mouseX = (event.clientX - window.innerWidth / 2) * 0.0004;
  mouseY = (event.clientY - window.innerHeight / 2) * 0.0004;
};

const onTouchMove = (event) => {
  if (event.touches.length > 0) {
    mouseX = (event.touches[0].clientX - window.innerWidth / 2) * 0.0006;
    mouseY = (event.touches[0].clientY - window.innerHeight / 2) * 0.0006;
  }
};

const onWindowResize = () => {
  if (!camera || !renderer) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
};

let clock = new THREE.Clock();

const animate = () => {
  animationFrameId = requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  // Smooth camera tilt & position interpolation
  targetX += (mouseX - targetX) * 0.04;
  targetY += (mouseY - targetY) * 0.04;

  camera.position.x = targetX * 25;
  camera.position.y = 18 + targetY * -15;
  camera.lookAt(0, -2, 0);

  // 1. Organic Undulating Wave Physics
  if (planeGeometry) {
    const pos = planeGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i);
      // Dual sine wave interference pattern
      const z = Math.sin(u * 0.12 + t * 1.2) * Math.cos(v * 0.12 + t * 0.9) * 3.5 +
                Math.sin((u + v) * 0.08 + t * 1.5) * 2.0;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
  }

  // 2. Sweeping Light Orbits
  if (light1) {
    light1.position.x = Math.sin(t * 0.6) * 45;
    light1.position.z = Math.cos(t * 0.6) * 35;
  }
  if (light2) {
    light2.position.x = Math.cos(t * 0.4) * -45;
    light2.position.z = Math.sin(t * 0.4) * 35;
  }
  if (light3) {
    light3.position.y = 25 + Math.sin(t * 0.8) * 10;
  }

  // 3. Floating Particles Motion
  if (particleSystem) {
    particleSystem.rotation.y = t * 0.03 + targetX * 0.5;
  }

  renderer.render(scene, camera);
};

const updateTheme = (newTheme) => {
  if (!scene) return;
  const colors = themePalettes[newTheme] || themePalettes.dark;

  scene.background = new THREE.Color(colors.bg);
  scene.fog.color = new THREE.Color(colors.fog);

  if (ambientLight) ambientLight.color = new THREE.Color(colors.ambient);
  if (light1) light1.color = new THREE.Color(colors.light1);
  if (light2) light2.color = new THREE.Color(colors.light2);
  if (light3) light3.color = new THREE.Color(colors.light3);

  if (waveMesh) {
    waveMesh.material.color = new THREE.Color(colors.wireframe);
    waveMesh.material.opacity = colors.wireframeOpacity;
    waveMesh.material.needsUpdate = true;
  }

  if (particleSystem) {
    const colAttr = particleSystem.geometry.attributes.color;
    const colorsArr = colAttr.array;
    for (let i = 0; i < colorsArr.length / 3; i++) {
      const c = new THREE.Color(colors.particles[i % colors.particles.length]);
      colorsArr[i * 3] = c.r;
      colorsArr[i * 3 + 1] = c.g;
      colorsArr[i * 3 + 2] = c.b;
    }
    colAttr.needsUpdate = true;
  }
};

watch(() => props.theme, (newTheme) => {
  updateTheme(newTheme);
});

onMounted(() => {
  initThree();
});

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('resize', onWindowResize);

  if (renderer && renderer.domElement) {
    renderer.domElement.remove();
  }
});
</script>

<style scoped>
.three-background-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 0.5s ease;
}
</style>
