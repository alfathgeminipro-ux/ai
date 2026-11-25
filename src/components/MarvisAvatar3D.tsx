import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { MarvisState } from '../types';
import { shouldRunRenderLoop } from '../utils/lazyRender';
import { useCardVisibility } from './LiquidCard';

interface MarvisAvatar3DProps {
  state: MarvisState;
  accentHex: string;
  accent2Hex: string;
  speechLevelRef: React.MutableRefObject<number>;
}

const _targetColor1 = new THREE.Color();
const _targetColor2 = new THREE.Color();
const _currColor1 = new THREE.Color('#3b82f6');
const _currColor2 = new THREE.Color('#38bdf8');

/**
 * Membuat tekstur garis scanline hologram prosedural menggunakan Canvas 2D
 * untuk memberi kesan proyeksi cahaya futuristik yang halus tanpa aset eksternal.
 */
function createScanlineTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0d1b36';
  ctx.fillRect(0, 0, 64, 128);

  for (let y = 0; y < 128; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, y, 64, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);
  return tex;
}

/**
 * Avatar 3D cowok futuristik hologram dibangun secara prosedural dengan Three.js:
 * - Wajah pria tegas (LatheGeometry halus), rahang bawah & equalizer mulut (lip-sync)
 * - Rambut pendek stylish swept-back berlapis, headset futuristik dengan mikrofon boom
 * - Tubuh bagian atas atletis dengan jaket hologram & garis sirkuit bercahaya
 * - Cincin hologram berputar di belakang yang merespons state idle/listening/thinking/speaking
 */
export function MarvisAvatar3D({
  state,
  accentHex,
  accent2Hex,
  speechLevelRef,
}: MarvisAvatar3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<MarvisState>(state);
  const accentRef = useRef(accentHex);
  const accent2Ref = useRef(accent2Hex);
  const { isInViewport, hasEnteredViewport } = useCardVisibility();
  const isInViewportRef = useRef(isInViewport);
  const resumeLoopRef = useRef<(() => void) | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  stateRef.current = state;
  accentRef.current = accentHex;
  accent2Ref.current = accent2Hex;
  isInViewportRef.current = isInViewport;

  // Lanjutkan render loop segera saat kartu kembali masuk viewport
  useEffect(() => {
    if (isInViewport && resumeLoopRef.current) {
      resumeLoopRef.current();
    }
  }, [isInViewport]);

  useEffect(() => {
    if (!hasEnteredViewport) return undefined;
    const mount = containerRef.current;
    if (!mount) return undefined;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param) ?? '');
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: isSoftwareGl,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const width = mount.clientWidth || 340;
    const height = mount.clientHeight || 280;
    renderer.setSize(width, height);
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
    camera.position.set(0, 0.28, 4.1);
    camera.lookAt(0, 0.18, 0);

    // Pencahayaan 3 titik
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x090f20, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.35);
    keyLight.position.set(2.2, 3.0, 3.5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(_currColor1.clone(), 3.6, 10);
    rimLight.position.set(-2.0, 1.5, -1.5);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(_currColor2.clone(), 2.4, 9);
    fillLight.position.set(1.9, -0.2, 2.3);
    scene.add(fillLight);

    // Tekstur scanline hologram prosedural
    const scanlineTex = createScanlineTexture();
    scanlineTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // ====== Material PBR + Hologram Dinamis ======
    _currColor1.set(accentRef.current);
    _currColor2.set(accent2Ref.current);

    const holoSkinMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#c8e4ff'),
      map: scanlineTex,
      emissive: _currColor1.clone(),
      emissiveIntensity: 0.48,
      metalness: 0.22,
      roughness: 0.34,
      clearcoat: 0.75,
      clearcoatRoughness: 0.22,
      transparent: true,
      opacity: 0.92,
    });

    const jacketMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0c172e'),
      map: scanlineTex,
      emissive: _currColor1.clone(),
      emissiveIntensity: 0.26,
      metalness: 0.68,
      roughness: 0.28,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#132548'),
      emissive: _currColor2.clone(),
      emissiveIntensity: 0.34,
      metalness: 0.36,
      roughness: 0.52,
    });

    const headsetMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e293b'),
      metalness: 0.88,
      roughness: 0.16,
    });

    const glowMat = new THREE.MeshStandardMaterial({
      color: _currColor2.clone(),
      emissive: _currColor2.clone(),
      emissiveIntensity: 2.0,
      metalness: 0.12,
      roughness: 0.14,
    });

    const wireOverlayMat = new THREE.MeshBasicMaterial({
      color: _currColor2.clone(),
      wireframe: true,
      transparent: true,
      opacity: 0.1,
    });

    const ringMatPrimary = new THREE.MeshBasicMaterial({
      color: _currColor1.clone(),
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });

    const ringMatSecondary = new THREE.MeshBasicMaterial({
      color: _currColor2.clone(),
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    });

    // ====== Hierarki Karakter Avatar 3D Cowok ======
    const avatarRoot = new THREE.Group();
    avatarRoot.position.y = -0.04;
    scene.add(avatarRoot);

    // Pedestal proyeksi hologram berlapis di bawah
    const baseRingOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.96, 48),
      new THREE.MeshBasicMaterial({
        color: _currColor1.clone(),
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    baseRingOuter.rotation.x = -Math.PI / 2;
    baseRingOuter.position.y = -0.98;
    avatarRoot.add(baseRingOuter);

    const baseRingInner = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.42, 36),
      new THREE.MeshBasicMaterial({
        color: _currColor2.clone(),
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    baseRingInner.rotation.x = -Math.PI / 2;
    baseRingInner.position.y = -0.96;
    avatarRoot.add(baseRingInner);

    // Grup tubuh bagian atas (animasi pernapasan idle)
    const torsoGroup = new THREE.Group();
    avatarRoot.add(torsoGroup);

    // Profil tubuh & bahu terpadu yang halus (tanpa bola bahu terpisah)
    const torsoPoints = [
      new THREE.Vector2(0.01, -0.94),
      new THREE.Vector2(0.45, -0.9),
      new THREE.Vector2(0.54, -0.58),
      new THREE.Vector2(0.76, -0.14),
      new THREE.Vector2(0.74, 0.02),
      new THREE.Vector2(0.46, 0.14),
      new THREE.Vector2(0.24, 0.2),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPoints, 36);
    torsoGeo.scale(1.12, 1, 0.56);
    const torsoMesh = new THREE.Mesh(torsoGeo, jacketMat);
    torsoGroup.add(torsoMesh);

    const torsoWire = new THREE.Mesh(torsoGeo, wireOverlayMat);
    torsoWire.scale.setScalar(1.012);
    torsoGroup.add(torsoWire);

    // Kerah jaket futuristik menyala
    const collarArc = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.34, 0.12, 0.19),
      new THREE.Vector3(-0.28, 0.25, 0.02),
      new THREE.Vector3(0, 0.3, -0.16),
      new THREE.Vector3(0.28, 0.25, 0.02),
      new THREE.Vector3(0.34, 0.12, 0.19),
    ]);
    const collarTube = new THREE.Mesh(
      new THREE.TubeGeometry(collarArc, 28, 0.026, 10, false),
      glowMat,
    );
    torsoGroup.add(collarTube);

    // Inti energi dada + garis sirkuit simetris
    const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), glowMat);
    chestCore.scale.set(1.25, 0.85, 0.32);
    chestCore.position.set(0, -0.24, 0.42);
    torsoGroup.add(chestCore);

    const chestTrimCurves = [
      [
        new THREE.Vector3(-0.62, -0.03, 0.16),
        new THREE.Vector3(-0.36, -0.18, 0.38),
        new THREE.Vector3(-0.1, -0.25, 0.43),
      ],
      [
        new THREE.Vector3(0.62, -0.03, 0.16),
        new THREE.Vector3(0.36, -0.18, 0.38),
        new THREE.Vector3(0.1, -0.25, 0.43),
      ],
      [
        new THREE.Vector3(-0.46, -0.58, 0.28),
        new THREE.Vector3(-0.22, -0.44, 0.38),
        new THREE.Vector3(-0.08, -0.31, 0.42),
      ],
      [
        new THREE.Vector3(0.46, -0.58, 0.28),
        new THREE.Vector3(0.22, -0.44, 0.38),
        new THREE.Vector3(0.08, -0.31, 0.42),
      ],
    ];
    for (const pts of chestTrimCurves) {
      const lineMesh = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 8, false),
        glowMat,
      );
      torsoGroup.add(lineMesh);
    }

    // Leher ramping
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.26, 24), holoSkinMat);
    neckMesh.position.set(0, 0.27, -0.01);
    torsoGroup.add(neckMesh);

    // ====== Kepala Cowok Halus (mengikuti kursor/jari) ======
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.42, 0.02);
    torsoGroup.add(headPivot);

    // Kontur kepala pria ergonomis via LatheGeometry (dahi, pelipis, tulang pipi, dagu tegas)
    const headProfile = [
      new THREE.Vector2(0.01, -0.04),
      new THREE.Vector2(0.15, 0.0),
      new THREE.Vector2(0.27, 0.12),
      new THREE.Vector2(0.33, 0.28),
      new THREE.Vector2(0.35, 0.46),
      new THREE.Vector2(0.32, 0.62),
      new THREE.Vector2(0.2, 0.72),
      new THREE.Vector2(0.01, 0.75),
    ];
    const headGeo = new THREE.LatheGeometry(headProfile, 32);
    headGeo.scale(0.95, 1.0, 1.04);
    const headMesh = new THREE.Mesh(headGeo, holoSkinMat);
    headPivot.add(headMesh);

    const headWire = new THREE.Mesh(headGeo, wireOverlayMat);
    headWire.scale.setScalar(1.015);
    headPivot.add(headWire);

    // Alis tegas + mata hologram bercahaya
    const eyeGeo = new THREE.CapsuleGeometry(0.02, 0.095, 6, 12);
    const leftEye = new THREE.Mesh(eyeGeo, glowMat);
    leftEye.rotation.z = Math.PI / 2 - 0.08;
    leftEye.position.set(-0.125, 0.37, 0.335);

    const rightEye = new THREE.Mesh(eyeGeo, glowMat);
    rightEye.rotation.z = Math.PI / 2 + 0.08;
    rightEye.position.set(0.125, 0.37, 0.335);
    headPivot.add(leftEye, rightEye);

    // Visor AR melengkung transparan di depan mata
    const visorGeo = new THREE.CylinderGeometry(0.355, 0.355, 0.115, 32, 1, true, -0.74, 1.48);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: _currColor2.clone(),
      emissive: _currColor1.clone(),
      emissiveIntensity: 0.35,
      metalness: 0.25,
      roughness: 0.08,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
    });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 0.37, 0.02);
    headPivot.add(visorMesh);

    // Grup mulut & dagu bawah terartikulasi untuk lip-sync
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, 0.16, 0.28);
    headPivot.add(jawGroup);

    const mouthCenter = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.085, 6, 10), glowMat);
    mouthCenter.rotation.z = Math.PI / 2;
    mouthCenter.position.set(0, 0, 0.02);
    jawGroup.add(mouthCenter);

    // Rambut pendek stylish swept-back (kurva halus bukan balok tajam)
    const hairGroup = new THREE.Group();
    headPivot.add(hairGroup);

    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.365, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.54),
      hairMat,
    );
    hairCap.scale.set(0.96, 1.02, 1.06);
    hairCap.position.set(0, 0.42, -0.02);
    hairGroup.add(hairCap);

    // 5 helai jambul stylish menyapu ke atas-belakang
    const hairStrands: Array<[THREE.Vector3[], number]> = [
      [
        [
          new THREE.Vector3(-0.04, 0.62, 0.28),
          new THREE.Vector3(0.02, 0.78, 0.12),
          new THREE.Vector3(0.05, 0.76, -0.18),
        ],
        0.075,
      ],
      [
        [
          new THREE.Vector3(-0.15, 0.58, 0.24),
          new THREE.Vector3(-0.12, 0.75, 0.08),
          new THREE.Vector3(-0.09, 0.72, -0.2),
        ],
        0.068,
      ],
      [
        [
          new THREE.Vector3(0.11, 0.59, 0.25),
          new THREE.Vector3(0.15, 0.74, 0.08),
          new THREE.Vector3(0.14, 0.7, -0.18),
        ],
        0.066,
      ],
      [
        [
          new THREE.Vector3(-0.24, 0.52, 0.14),
          new THREE.Vector3(-0.26, 0.64, -0.04),
          new THREE.Vector3(-0.22, 0.58, -0.24),
        ],
        0.055,
      ],
      [
        [
          new THREE.Vector3(0.24, 0.52, 0.14),
          new THREE.Vector3(0.26, 0.64, -0.04),
          new THREE.Vector3(0.22, 0.58, -0.24),
        ],
        0.055,
      ],
    ];
    for (const [pts, radius] of hairStrands) {
      const strand = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, radius, 10, false),
        hairMat,
      );
      hairGroup.add(strand);
    }

    // Headset futuristik + mic boom
    const bandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.37, 0.35, -0.01),
      new THREE.Vector3(-0.38, 0.68, -0.02),
      new THREE.Vector3(0, 0.85, -0.03),
      new THREE.Vector3(0.38, 0.68, -0.02),
      new THREE.Vector3(0.37, 0.35, -0.01),
    ]);
    const headband = new THREE.Mesh(
      new THREE.TubeGeometry(bandCurve, 30, 0.028, 10, false),
      headsetMat,
    );
    headPivot.add(headband);

    const earCupGeo = new THREE.CylinderGeometry(0.135, 0.12, 0.085, 24);
    const earGlowGeo = new THREE.TorusGeometry(0.1, 0.015, 10, 28);

    const leftEar = new THREE.Mesh(earCupGeo, headsetMat);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-0.38, 0.35, -0.01);
    const leftEarRing = new THREE.Mesh(earGlowGeo, glowMat);
    leftEarRing.rotation.y = Math.PI / 2;
    leftEarRing.position.set(-0.425, 0.35, -0.01);

    const rightEar = new THREE.Mesh(earCupGeo, headsetMat);
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(0.38, 0.35, -0.01);
    const rightEarRing = new THREE.Mesh(earGlowGeo, glowMat);
    rightEarRing.rotation.y = Math.PI / 2;
    rightEarRing.position.set(0.425, 0.35, -0.01);
    headPivot.add(leftEar, leftEarRing, rightEar, rightEarRing);

    const micCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.38, 0.29, 0.04),
      new THREE.Vector3(0.35, 0.19, 0.24),
      new THREE.Vector3(0.15, 0.16, 0.36),
    ]);
    const micBoom = new THREE.Mesh(
      new THREE.TubeGeometry(micCurve, 16, 0.013, 8, false),
      headsetMat,
    );
    const micTip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), glowMat);
    micTip.position.set(0.15, 0.16, 0.36);
    headPivot.add(micBoom, micTip);

    // ====== Cincin Cahaya Hologram Berputar di Belakang ======
    const ringsGroup = new THREE.Group();
    ringsGroup.position.set(0, 0.34, -0.62);
    scene.add(ringsGroup);

    const outerHalo = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.018, 12, 72), ringMatPrimary);
    const innerHalo = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.013, 10, 64), ringMatSecondary);
    const tiltedRing = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.011, 10, 64), ringMatSecondary);
    tiltedRing.rotation.x = Math.PI / 3;
    ringsGroup.add(outerHalo, innerHalo, tiltedRing);

    const orbitNodesGroup = new THREE.Group();
    ringsGroup.add(orbitNodesGroup);
    const nodeGeo = new THREE.OctahedronGeometry(0.04, 0);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const node = new THREE.Mesh(nodeGeo, glowMat);
      node.position.set(Math.cos(angle) * 1.16, Math.sin(angle) * 1.16, 0);
      orbitNodesGroup.add(node);
    }

    // Tracking kursor/jari agar kepala mengikuti arah pandang pengguna
    const pointerTarget = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      pointerTarget.x = THREE.MathUtils.clamp(nx, -1, 1);
      pointerTarget.y = THREE.MathUtils.clamp(ny, -1, 1);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // Resize observer: render ulang seketika setelah resize agar canvas tidak pernah kosong
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(160, Math.floor(entry.contentRect.width));
        const h = Math.max(180, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.render(scene, camera);
      }
    });
    resizeObserver.observe(mount);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // ====== Loop Animasi Tanpa Deprecation Warning + Jeda Otomatis Saat Offscreen ======
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameId = 0;
    let disposed = false;
    let loopPaused = false;
    let headYaw = 0;
    let headPitch = 0;
    let ringScale = 1;
    let blinkTimer = 3.2;
    const startMs = performance.now();
    let prevMs = startMs;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const syncState = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (syncState === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 85);
        }
      };
      frameId = window.setTimeout(poll, 6);
    }

    const tick = () => {
      if (disposed) return;

      // Hentikan sepenuhnya render loop ketika kartu di luar viewport atau tab tidak aktif
      if (
        !shouldRunRenderLoop({
          isInViewport: isInViewportRef.current,
          isDocumentHidden: document.hidden,
        })
      ) {
        loopPaused = true;
        return;
      }

      loopPaused = false;
      const nowMs = performance.now();
      const dt = Math.min((nowMs - prevMs) / 1000, 0.08);
      prevMs = nowMs;
      const elapsed = (nowMs - startMs) / 1000;
      const currentState = stateRef.current;

      // Transisi warna tema halus (~600ms)
      _targetColor1.set(accentRef.current);
      _targetColor2.set(accent2Ref.current);
      const colorStep = 1 - Math.exp(-5.5 * dt);
      _currColor1.lerp(_targetColor1, colorStep);
      _currColor2.lerp(_targetColor2, colorStep);

      holoSkinMat.emissive.copy(_currColor1);
      jacketMat.emissive.copy(_currColor1);
      hairMat.emissive.copy(_currColor2);
      glowMat.color.copy(_currColor2);
      glowMat.emissive.copy(_currColor2);
      wireOverlayMat.color.copy(_currColor2);
      visorMat.color.copy(_currColor2);
      visorMat.emissive.copy(_currColor1);
      ringMatPrimary.color.copy(_currColor1);
      ringMatSecondary.color.copy(_currColor2);
      (baseRingOuter.material as THREE.MeshBasicMaterial).color.copy(_currColor1);
      (baseRingInner.material as THREE.MeshBasicMaterial).color.copy(_currColor2);
      rimLight.color.copy(_currColor1);
      fillLight.color.copy(_currColor2);

      if (!reducedMotion) {
        // Pergerakan scanline hologram pelan
        scanlineTex.offset.y = (elapsed * 0.14) % 1;

        // Pernapasan idle halus
        torsoGroup.position.y = Math.sin(elapsed * 1.8) * 0.028;
        avatarRoot.rotation.y = Math.sin(elapsed * 0.55) * 0.045;

        // Kepala mengikuti kursor/jari
        const targetYaw = pointerTarget.x * 0.4;
        const targetPitch = pointerTarget.y * 0.2;
        headYaw = THREE.MathUtils.damp(headYaw, targetYaw, 5.5, dt);
        headPitch = THREE.MathUtils.damp(headPitch, targetPitch, 5.5, dt);
        headPivot.rotation.y = headYaw;
        headPivot.rotation.x = headPitch;

        // Kedipan mata natural
        blinkTimer -= dt;
        const eyeScaleX = blinkTimer < 0.09 ? 0.22 : 1;
        if (blinkTimer < 0) blinkTimer = 2.8 + Math.random() * 2.6;
        leftEye.scale.x = THREE.MathUtils.damp(leftEye.scale.x, eyeScaleX, 26, dt);
        rightEye.scale.x = leftEye.scale.x;

        // State visual + lip-sync mulut
        let targetRingScale = 1;
        let spinSpeed = 0.45;
        let emissiveBoost = 1.9;
        let jawOpen = 0;

        if (currentState === 'listening') {
          targetRingScale = 1.2 + Math.sin(elapsed * 5.2) * 0.05;
          spinSpeed = 1.15;
          emissiveBoost = 2.5;
        } else if (currentState === 'thinking') {
          targetRingScale = 1.08;
          spinSpeed = 3.2;
          emissiveBoost = 2.7;
        } else if (currentState === 'speaking') {
          const amp = Math.max(
            speechLevelRef.current,
            0.35 + 0.45 * Math.abs(Math.sin(elapsed * 13.5) * Math.cos(elapsed * 5.7)),
          );
          targetRingScale = 1.04 + amp * 0.18;
          spinSpeed = 1.5;
          emissiveBoost = 2.1 + amp * 1.25;
          jawOpen = amp;
        }

        ringScale = THREE.MathUtils.damp(ringScale, targetRingScale, 7, dt);
        ringsGroup.scale.setScalar(ringScale);
        outerHalo.rotation.z += dt * spinSpeed;
        innerHalo.rotation.z -= dt * spinSpeed * 1.35;
        tiltedRing.rotation.y += dt * spinSpeed * 1.15;
        orbitNodesGroup.rotation.z += dt * spinSpeed * 1.6;
        glowMat.emissiveIntensity = THREE.MathUtils.damp(
          glowMat.emissiveIntensity,
          emissiveBoost,
          9,
          dt,
        );

        // Lip-sync mulut hologram
        mouthCenter.scale.x = THREE.MathUtils.damp(mouthCenter.scale.x, 1 + jawOpen * 2.9, 22, dt);
        mouthCenter.scale.y = THREE.MathUtils.damp(mouthCenter.scale.y, 1 + jawOpen * 0.28, 18, dt);
        chestCore.scale.setScalar(1 + (currentState === 'speaking' ? jawOpen * 0.14 : 0));
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    const resumeIfNeeded = () => {
      if (disposed || !loopPaused) return;
      if (
        shouldRunRenderLoop({
          isInViewport: isInViewportRef.current,
          isDocumentHidden: document.hidden,
        })
      ) {
        prevMs = performance.now();
        loopPaused = false;
        tick();
      }
    };

    resumeLoopRef.current = resumeIfNeeded;
    const handleVisibilityChange = () => {
      if (!document.hidden) resumeIfNeeded();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    tick();

    return () => {
      disposed = true;
      resumeLoopRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      scanlineTex.dispose();
      envTarget.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [hasEnteredViewport, speechLevelRef]);

  if (webglFailed) {
    return (
      <div
        data-testid="marvis-avatar-fallback"
        className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-slate-950/60 p-6 text-center"
      >
        <div
          className="mb-3 flex h-24 w-24 items-center justify-center rounded-full border border-white/20"
          style={{
            background: 'radial-gradient(circle, var(--accent-2), var(--accent), transparent 72%)',
            boxShadow: '0 0 40px var(--glow)',
          }}
        >
          <span className="font-display text-2xl font-bold text-white">M</span>
        </div>
        <p className="text-sm font-medium text-white/90">Hologram MARVIS</p>
        <p className="mt-1 text-xs text-slate-400">Mode 2D ringan aktif</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="marvis-avatar-canvas"
      data-avatar-state={state}
      data-render-active={isInViewport ? 'true' : 'false'}
      className="relative h-full w-full min-h-[250px] select-none"
      aria-label={`Avatar hologram 3D MARVIS dalam status ${state}`}
    >
      {!hasEnteredViewport && (
        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
          Menyiapkan hologram 3D...
        </div>
      )}
    </div>
  );
}
