// ===== 3D 场景：金色粒子星云 + 旋转环面结 =====
(function () {
  const canvas = document.getElementById('bg3d');
  if (!canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  // 金色主物体：环面结
  const torus = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.6, 0.42, 220, 32),
    new THREE.MeshStandardMaterial({
      color: 0xf5a524,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x3a2408,
      emissiveIntensity: 0.6
    })
  );
  torus.position.set(3.4, -0.6, -2.5);
  scene.add(torus);

  // 副物体：暖橙八面体
  const octa = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8, 0),
    new THREE.MeshStandardMaterial({
      color: 0xff6b35, metalness: 0.7, roughness: 0.3,
      emissive: 0x33150a, emissiveIntensity: 0.7
    })
  );
  octa.position.set(-4.2, 1.4, -3);
  scene.add(octa);

  // 副物体：玫红小环
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.18, 24, 48),
    new THREE.MeshStandardMaterial({
      color: 0xe11d48, metalness: 0.6, roughness: 0.35,
      emissive: 0x2a0610, emissiveIntensity: 0.8
    })
  );
  ring.position.set(-3.2, -1.8, -2);
  ring.rotation.x = Math.PI / 3;
  scene.add(ring);

  // 粒子星云
  const COUNT = 900;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2;
  }
  const points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xffb454, size: 0.035, transparent: true, opacity: 0.85 })
  );
  points.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(points);

  // 灯光
  scene.add(new THREE.AmbientLight(0xfff2dd, 0.35));
  const key = new THREE.DirectionalLight(0xffc46b, 1.6);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe11d48, 0.8);
  rim.position.set(-6, -3, 2);
  scene.add(rim);

  // 鼠标视差
  let mx = 0, my = 0, tx = 0, ty = 0;
  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // 滚动驱动
  let scrollFactor = 0;
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    scrollFactor = h > 0 ? window.scrollY / h : 0;
  }, { passive: true });

  let t = 0;
  const clock = new THREE.Clock();
  function tick() {
    const dt = clock.getDelta();
    t += dt;
    tx += (mx - tx) * 0.04;
    ty += (my - ty) * 0.04;

    torus.rotation.x = t * 0.35 + ty * 0.4;
    torus.rotation.y = t * 0.5 + tx * 0.4;
    octa.rotation.x = t * 0.6;
    octa.rotation.y = t * 0.8;
    ring.rotation.z = t * 0.9;

    points.rotation.y = t * 0.03;
    camera.position.x = tx * 0.6;
    camera.position.y = -ty * 0.4 - scrollFactor * 2.2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();