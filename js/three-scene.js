// ===== 3D 场景：暖纸上的陶瓷漂浮物 =====
(function () {
  const canvas = document.getElementById('bg3d');
  if (!canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  // 主物体：陶土色环面结（哑光陶瓷质感）
  const torus = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.6, 0.42, 220, 32),
    new THREE.MeshStandardMaterial({
      color: 0xc96f3d,
      metalness: 0.05,
      roughness: 0.8,
      emissive: 0x3a1f10,
      emissiveIntensity: 0.12
    })
  );
  torus.position.set(3.4, -0.6, -2.5);
  scene.add(torus);

  // 副物体：墨绿八面体
  const octa = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8, 0),
    new THREE.MeshStandardMaterial({
      color: 0x2f5d4a, metalness: 0.05, roughness: 0.85,
      emissive: 0x0e2118, emissiveIntensity: 0.15
    })
  );
  octa.position.set(-4.2, 1.4, -3);
  scene.add(octa);

  // 副物体：朱砂小环
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.18, 24, 48),
    new THREE.MeshStandardMaterial({
      color: 0xc2402b, metalness: 0.05, roughness: 0.8,
      emissive: 0x2a0e08, emissiveIntensity: 0.15
    })
  );
  ring.position.set(-3.2, -1.8, -2);
  ring.rotation.x = Math.PI / 3;
  scene.add(ring);

  // 粒子：奶油暖点 + 少量朱砂点
  const COUNT = 700, COUNT2 = 140;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2;
  }
  const points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xcaa25e, size: 0.045, transparent: true, opacity: 0.6 })
  );
  points.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(points);

  const pos2 = new Float32Array(COUNT2 * 3);
  for (let i = 0; i < COUNT2; i++) {
    pos2[i * 3] = (Math.random() - 0.5) * 24;
    pos2[i * 3 + 1] = (Math.random() - 0.5) * 14;
    pos2[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
  }
  const points2 = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xc2402b, size: 0.05, transparent: true, opacity: 0.45 })
  );
  points2.geometry.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
  scene.add(points2);

  // 灯光（暖光为主）
  scene.add(new THREE.AmbientLight(0xfff3e0, 0.9));
  const key = new THREE.DirectionalLight(0xffe9c9, 1.4);
  key.position.set(4, 6, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-4, 2, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x2f5d4a, 0.5);
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
    points2.rotation.y = -t * 0.04;
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