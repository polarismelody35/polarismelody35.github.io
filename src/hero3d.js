/* ==========================================================
   Polaris Melody 35 — HOME 3D universe (Three.js)

   A real 3D space behind the hero title:
   - three tilted orbits with a glossy planet for every song
   - stardust floating at different depths
   - drag (or swipe sideways) to look around, it drifts back on its own
   - hover a planet to see the song, click / tap it to listen

   This file is the SOURCE. The site loads the bundled, minified
   copy: assets/js/hero3d.min.js. After editing this file, rebuild:
     npx esbuild src/hero3d.js --bundle --minify --format=esm --outfile=assets/js/hero3d.min.js
   (needs `npm i three esbuild` once).

   It also turns the song stars in "Every star is a song" into real
   3D spheres (see startStarMap below).

   If WebGL is not available the page keeps its CSS orbits / CSS stars.
   ========================================================== */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Sprite, SpriteMaterial,
  SphereGeometry, TorusGeometry, RingGeometry, BufferGeometry, Float32BufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, PointsMaterial, Points,
  HemisphereLight, DirectionalLight, PointLight, CanvasTexture, Color, Vector2, Vector3,
  Raycaster, SRGBColorSpace, DoubleSide, OrthographicCamera, AmbientLight
} from "three";

function glowTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, outer);
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const hero = document.getElementById("home");
const PM = window.PM35;

function start() {
  if (!hero || !PM) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const small = window.matchMedia("(max-width: 700px)");
  const lite = small.matches || !fine.matches; // phones & tablets: lighter scene

  /* ---------- renderer ---------- */
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: !lite, alpha: true, powerPreference: "low-power" });
  } catch (e) {
    return; // no WebGL → CSS orbits stay
  }
  if (!renderer.getContext()) return;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2));
  const canvas = renderer.domElement;
  canvas.className = "hero-3d";
  canvas.setAttribute("aria-hidden", "true");
  hero.insertBefore(canvas, hero.querySelector(".hero-glow"));
  hero.classList.add("has-3d");

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 200);
  let camDist = 24;

  /* ---------- light: soft, from the upper left, lavender bounce ---------- */
  scene.add(new HemisphereLight(0xffffff, 0xcfc6e6, 2.2));
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(-6, 8, 10);
  scene.add(key);
  const core = new PointLight(0xe9e2ff, 30, 30, 1.6);
  scene.add(core);

  /* ---------- textures drawn on a canvas (no image files needed) ---------- */
  function dotTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.4, "rgba(255,255,255,0.8)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new CanvasTexture(c);
  }

  /* ---------- world: root (drag) → system (fixed tilt) ---------- */
  const root = new Group();
  scene.add(root);
  const system = new Group();
  system.rotation.set(1.12, 0, -0.2); // like looking at the orbits from slightly above
  root.add(system);

  // the light at the centre (Polaris)
  const halo = new Sprite(new SpriteMaterial({ map: glowTexture("rgba(255,255,255,0.95)", "rgba(226,219,248,0.45)"), depthWrite: false }));
  halo.scale.set(9, 9, 1);
  root.add(halo);

  // orbits
  const ORBITS = [
    null,
    { r: 3.9, color: "#A497D8", period: 38, dir: 1 },
    { r: 6.2, color: "#C79DA6", period: 62, dir: -1 },
    { r: 8.6, color: "#83A6CB", period: 96, dir: 1 }
  ];
  for (let i = 1; i <= 3; i++) {
    const o = ORBITS[i];
    const line = new Mesh(
      new TorusGeometry(o.r, 0.014, 6, 220),
      new MeshBasicMaterial({ color: o.color, transparent: true, opacity: 0.55, depthWrite: false })
    );
    const glow = new Mesh(
      new TorusGeometry(o.r, 0.09, 6, 160),
      new MeshBasicMaterial({ color: o.color, transparent: true, opacity: 0.07, depthWrite: false })
    );
    system.add(line, glow);
    o.group = new Group();
    system.add(o.group);
  }

  // planets = songs
  const songs = PM.songs || [];
  const sphere = new SphereGeometry(1, lite ? 32 : 48, lite ? 20 : 32);
  const glowTex = glowTexture("rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)");
  const planets = [];
  let ringed = false;
  songs.forEach((song, i) => {
    const s = song.star || {};
    const orbit = s.orbit >= 1 && s.orbit <= 3 ? s.orbit : 1 + (i % 3);
    const angleDeg = typeof s.angle === "number" ? s.angle : (i * 137.5 + 30) % 360;
    const released = song.status === "released";
    const color = new Color(PM.colorOf(song.id, i));
    const size = released ? 0.42 : 0.28;

    const holder = new Group();
    const body = new Mesh(sphere, new MeshStandardMaterial({
      color, roughness: 0.32, metalness: 0.05,
      emissive: color, emissiveIntensity: 0.18,
      transparent: !released, opacity: released ? 1 : 0.6
    }));
    body.scale.setScalar(size);
    body.userData.id = song.id;
    holder.add(body);

    const glow = new Sprite(new SpriteMaterial({ map: glowTex, color, transparent: true, opacity: released ? 0.55 : 0.3, depthWrite: false }));
    glow.scale.setScalar(size * 4.2);
    holder.add(glow);

    // one planet gets a little Saturn ring
    if (released && orbit === 2 && !ringed) {
      ringed = true;
      const ring = new Mesh(
        new RingGeometry(1.5, 1.85, 64),
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.42, side: DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -1.1;
      body.add(ring);
    }

    ORBITS[orbit].group.add(holder);
    planets.push({
      song, body, glow, holder, orbit, released,
      angle: (angleDeg - 90) * Math.PI / 180,
      size, hover: 0, bob: Math.random() * Math.PI * 2
    });
  });

  // stardust at many depths
  const DUST = lite ? 220 : 520;
  const pos = [], col = [];
  const palette = ["#8F86B8", "#C79DA6", "#D2AE6A", "#83A6CB", "#A497D8", "#D58FA6"].map((c) => new Color(c));
  for (let i = 0; i < DUST; i++) {
    const r = 5 + Math.random() * 30;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th));
    const c = palette[i % palette.length];
    col.push(c.r, c.g, c.b);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  dustGeo.setAttribute("color", new Float32BufferAttribute(col, 3));
  const dust = new Points(dustGeo, new PointsMaterial({
    size: 0.16, map: dotTexture(), vertexColors: true, transparent: true, opacity: 0.75,
    depthWrite: false, sizeAttenuation: true
  }));
  root.add(dust);

  /* ---------- planet name tooltip ---------- */
  const tip = document.createElement("div");
  tip.className = "planet-tip";
  tip.setAttribute("aria-hidden", "true");
  tip.innerHTML = '<span class="planet-tip-title"></span><span class="planet-tip-hint"></span>';
  hero.appendChild(tip);

  /* ---------- size ---------- */
  let W = 1, H = 1;
  function resize() {
    const r = hero.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    // keep the inner orbits on screen in tall (phone) screens
    camDist = 24 / Math.min(1, Math.max(0.55, camera.aspect * 1.25));
    camera.updateProjectionMatrix();
    needsFrame = true;
  }

  /* ---------- input: drag to look around, click a planet ---------- */
  const view = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
  let dragging = false, downX = 0, downY = 0, lastX = 0, lastY = 0, moved = 0, lastInput = 0, pid = null;
  const pointer = new Vector2(), ndc = new Vector2(2, 2), par = { x: 0, y: 0, sx: 0, sy: 0 };
  const ray = new Raycaster();
  let hovered = null;

  function isUi(t) { return t && t.closest && t.closest("a, button, input, .site-header"); }
  function toNdc(e) {
    const r = hero.getBoundingClientRect();
    pointer.set(e.clientX - r.left, e.clientY - r.top);
    ndc.set((pointer.x / W) * 2 - 1, -(pointer.y / H) * 2 + 1);
    par.x = pointer.x / W - 0.5; par.y = pointer.y / H - 0.5;
  }
  function pick() {
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(planets.map((p) => p.body), false);
    return hits.length ? planets.find((p) => p.body === hits[0].object) : null;
  }
  function setHover(p) {
    if (p === hovered) return;
    hovered = p;
    hero.classList.toggle("is-planet-hover", !!p);
    if (p) {
      tip.querySelector(".planet-tip-title").textContent = PM.titleOf(p.song.id);
      tip.querySelector(".planet-tip-hint").textContent = PM.hintOf(p.song.id);
      tip.style.setProperty("--c", PM.colorOf(p.song.id, songs.indexOf(p.song)));
    }
    tip.classList.toggle("is-visible", !!p);
    wake();
  }

  hero.addEventListener("pointerdown", (e) => {
    if (isUi(e.target) || e.button > 0) return;
    toNdc(e);
    dragging = true; pid = e.pointerId; moved = 0;
    downX = lastX = e.clientX; downY = lastY = e.clientY;
    view.vy = view.vp = 0;
    hero.classList.add("is-dragging");
    wake();
  });
  window.addEventListener("pointermove", (e) => {
    if (dragging && e.pointerId === pid) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
      view.vy = dx * 0.0055;
      view.vp = e.pointerType === "touch" ? 0 : dy * 0.0045; // on phones, vertical swipes scroll the page
      view.yaw += view.vy;
      view.pitch = Math.max(-0.75, Math.min(0.55, view.pitch + view.vp));
      lastInput = performance.now();
      setHover(null);
      wake();
      return;
    }
    if (e.pointerType !== "mouse") return;
    const r = hero.getBoundingClientRect();
    if (e.clientY > r.bottom || e.clientY < r.top) { setHover(null); par.x = par.y = 0; return; }
    toNdc(e);
    setHover(isUi(e.target) ? null : pick());
    wake();
  }, { passive: true });
  function endDrag(e) {
    if (!dragging || (e && e.pointerId !== pid)) return;
    dragging = false;
    hero.classList.remove("is-dragging");
    if (e && e.type === "pointerup" && moved < 7) {
      toNdc(e);
      const p = pick();
      if (p) {
        p.hover = 1.6; // a little pop
        PM.openSong(p.song.id);
      }
    }
    lastInput = performance.now();
    wake();
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", (e) => { if (e.pointerId === pid) { dragging = false; hero.classList.remove("is-dragging"); view.vy = view.vp = 0; } });
  hero.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { setHover(null); par.x = par.y = 0; } });

  /* ---------- loop (pauses when the hero is off screen) ---------- */
  let raf = null, visible = true, needsFrame = true, prev = performance.now(), t = 0;
  function wake() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  const tmp = new Vector3();
  function frame(now) {
    raf = null;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const still = reduce.matches;
    if (!still) t += dt;

    // inertia after a drag, then drift slowly back home
    if (!dragging) {
      view.yaw += view.vy; view.pitch = Math.max(-0.75, Math.min(0.55, view.pitch + view.vp));
      view.vy *= 0.94; view.vp *= 0.9;
      if (now - lastInput > 2500) {
        view.pitch += (0 - view.pitch) * 0.02;
        view.yaw += (Math.round(view.yaw / (Math.PI * 2)) * Math.PI * 2 - view.yaw) * 0.006;
      }
    }
    root.rotation.set(view.pitch, view.yaw, 0);

    // gentle mouse parallax
    par.sx += (par.x - par.sx) * 0.05;
    par.sy += (par.y - par.sy) * 0.05;
    camera.position.set(par.sx * 2.2, -par.sy * 1.6 + 0.3, camDist);
    camera.lookAt(0, 0, 0);

    // planets travel around their orbits
    for (const p of planets) {
      const o = ORBITS[p.orbit];
      const a = p.angle + (still ? 0 : (t / o.period) * Math.PI * 2 * o.dir);
      p.holder.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r, still ? 0 : Math.sin(t * 0.8 + p.bob) * 0.08);
      const target = p === hovered ? 1.4 : 1;
      p.hover += (target - p.hover) * 0.15;
      p.body.scale.setScalar(p.size * p.hover);
      p.body.rotation.y += still ? 0 : dt * 0.4;
      p.glow.scale.setScalar(p.size * 4.2 * (0.9 + (p.hover - 1) * 1.4 + (still ? 0.1 : Math.sin(t * 2 + p.bob) * 0.06 + 0.1)));
    }
    dust.rotation.y = still ? 0 : t * 0.012;
    halo.material.opacity = still ? 0.85 : 0.75 + Math.sin(t * 0.9) * 0.15;

    // tooltip follows the hovered planet
    if (hovered) {
      hovered.body.getWorldPosition(tmp).project(camera);
      tip.style.transform = "translate(" + ((tmp.x + 1) / 2 * W).toFixed(1) + "px," + ((1 - tmp.y) / 2 * H).toFixed(1) + "px)";
    }

    renderer.render(scene, camera);
    needsFrame = false;

    const settling = Math.abs(view.vy) > 1e-4 || Math.abs(view.vp) > 1e-4 || Math.abs(view.pitch) > 1e-3 ||
      Math.abs(par.x - par.sx) > 1e-3 || Math.abs(par.y - par.sy) > 1e-3;
    if (visible && (!still || dragging || settling || hovered)) raf = requestAnimationFrame(frame);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) { prev = performance.now(); wake(); } }).observe(hero);
  }
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) { prev = performance.now(); wake(); } });
  if ("ResizeObserver" in window) new ResizeObserver(() => { resize(); wake(); }).observe(hero);
  else window.addEventListener("resize", () => { resize(); wake(); });
  reduce.addEventListener && reduce.addEventListener("change", wake);

  resize();
  wake();
  requestAnimationFrame(() => hero.classList.add("is-3d-in"));
}

/* ==========================================================
   "Every star is a song" — the stars become glossy 3D spheres.
   The HTML buttons stay exactly as they are (clicks, keyboard,
   labels, selection rings); a transparent WebGL layer draws a
   lit, slowly turning sphere where each button's ball is.
   ========================================================== */
function bandTexture() {
  // soft gas-giant bands, white-ish, tinted by each star's colour
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 9; i++) {
    const y = Math.random() * 128, h = 4 + Math.random() * 16;
    g.fillStyle = "rgba(" + (Math.random() < 0.5 ? "70,60,110" : "255,255,255") + "," + (0.05 + Math.random() * 0.12) + ")";
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3);
    g.lineTo(256, y + h); g.lineTo(0, y + h); g.closePath();
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function startStarMap() {
  const map = document.querySelector(".star-map");
  const list = document.getElementById("starList");
  if (!map || !list) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lite = window.matchMedia("(max-width: 700px)").matches || !window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) {
    return; // no WebGL → CSS stars stay
  }
  if (!renderer.getContext()) return;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.75 : 2));
  const canvas = renderer.domElement;
  canvas.className = "star-map-3d";
  canvas.setAttribute("aria-hidden", "true");
  map.appendChild(canvas);
  map.classList.add("has-3d");

  const scene = new Scene();
  // 1 unit = 1 CSS pixel; y goes down like the page
  const camera = new OrthographicCamera(0, 1, 0, 1, -500, 500);
  camera.position.z = 100;
  scene.add(new AmbientLight(0xffffff, 0.55));
  scene.add(new HemisphereLight(0xf3eff6, 0x2a2d48, 1.4));
  const key = new DirectionalLight(0xffffff, 3.2);
  key.position.set(-0.6, -0.8, 1); // upper left (y is flipped)
  scene.add(key);
  const rim = new DirectionalLight(0xc9bff0, 1.6);
  rim.position.set(0.8, 0.6, -0.4);
  scene.add(rim);

  const sphere = new SphereGeometry(1, 48, 32);
  const glowTex = glowTexture("rgba(255,255,255,0.95)", "rgba(255,255,255,0.32)");
  const items = new Map(); // button → { body, glow, tilt, spin, phase }

  function itemFor(btn) {
    let it = items.get(btn);
    if (it) return it;
    const color = new Color(btn.style.getPropertyValue("--c").trim() || "#CBC2EE");
    const soon = btn.classList.contains("is-soon");
    const body = new Mesh(sphere, new MeshStandardMaterial({
      color, map: bandTexture(), roughness: 0.38, metalness: 0.08,
      emissive: color, emissiveIntensity: 0.28,
      transparent: soon, opacity: soon ? 0.8 : 1
    }));
    const holder = new Group();
    holder.rotation.set(0.35 + Math.random() * 0.3, 0, -0.25 + Math.random() * 0.5); // each has its own axis tilt
    holder.add(body);
    const glow = new Sprite(new SpriteMaterial({ map: glowTex, color, transparent: true, opacity: soon ? 0.35 : 0.6, depthWrite: false }));
    scene.add(glow, holder);
    it = { body, holder, glow, color, soon, spin: 0.25 + Math.random() * 0.35, phase: Math.random() * 6.28 };
    items.set(btn, it);
    return it;
  }
  function dispose(it) {
    scene.remove(it.holder, it.glow);
    it.body.material.map.dispose();
    it.body.material.dispose();
    it.glow.material.dispose();
  }

  let W = 1, H = 1;
  function resize() {
    W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
    renderer.setSize(W, H, false);
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = H;
    camera.updateProjectionMatrix();
  }

  let raf = null, visible = false, t = 0, prev = performance.now();
  function frame(now) {
    raf = null;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const still = reduce.matches;
    if (!still) t += dt;

    const cr = canvas.getBoundingClientRect();
    const sx = W / (cr.width || 1), sy = H / (cr.height || 1);
    const seen = new Set();
    list.querySelectorAll(".star").forEach((btn) => {
      const core = btn.querySelector(".star-core");
      if (!core) return;
      const it = itemFor(btn);
      seen.add(btn);
      const r = core.getBoundingClientRect(); // includes hover / selected scale and the float
      const x = (r.left + r.width / 2 - cr.left) * sx;
      const y = (r.top + r.height / 2 - cr.top) * sy;
      const rad = (r.width / 2) * sx * 1.15; // a little bigger than the CSS ball
      const on = btn.getAttribute("aria-pressed") === "true" || btn.matches(":hover, :focus-visible") || btn.classList.contains("is-playing");
      it.holder.position.set(x, y, 0);
      it.holder.scale.setScalar(rad);
      it.body.rotation.y += still ? 0 : dt * it.spin;
      const breathe = still ? 0 : Math.sin(t * 0.9 + it.phase) * 0.06;
      it.body.material.emissiveIntensity = (on ? 0.5 : 0.34) + breathe;
      it.glow.position.set(x, y, -1);
      it.glow.scale.setScalar(rad * (on ? 5.6 : 4.6) * (1 + breathe));
      it.glow.material.opacity = Math.min(1, (it.soon ? 0.4 : 0.75) * (on ? 1.25 : 1));
    });
    items.forEach((it, btn) => { if (!seen.has(btn)) { dispose(it); items.delete(btn); } }); // re-rendered (language change)

    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf && visible) { prev = performance.now(); raf = requestAnimationFrame(frame); } }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((en) => { visible = en[0].isIntersecting && !document.hidden; wake(); }).observe(map);
  } else { visible = true; }
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; wake(); });
  if ("ResizeObserver" in window) new ResizeObserver(() => { resize(); wake(); }).observe(canvas);
  else window.addEventListener("resize", () => { resize(); wake(); });
  resize();
  wake();
}

start();
startStarMap();
