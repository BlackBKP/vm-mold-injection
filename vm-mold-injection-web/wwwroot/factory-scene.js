import * as THREE from "three";
import { OrbitControls } from "./vendor/three/OrbitControls.js";

export function createFactoryScene(onSelect, onPhase) {
  const host = document.querySelector("#scene");
  const canvas = document.querySelector("#factory-canvas");
  const labelLayer = document.querySelector("#machine-labels");
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - .04;
  controls.minDistance = 5;
  controls.maxDistance = 95;
  controls.target.set(0, 1, 0);
  const ambient = new THREE.HemisphereLight(0xe8f6ff, 0x526579, 2.6);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(-12, 24, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32 });
  sun.shadow.bias = -.0005;
  sun.shadow.normalBias = .03;
  scene.add(sun);

  const materials = {
    blue: new THREE.MeshStandardMaterial({ color: 0x0877af, metalness: .3, roughness: .32 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb4c4cf, metalness: .65, roughness: .3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x344350, metalness: .3, roughness: .5 }),
    window: new THREE.MeshStandardMaterial({ color: 0x142a38, metalness: .3, roughness: .22 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x8cdefa, emissive: 0x226388, emissiveIntensity: .35 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe2b349, roughness: .8 }),
    floor: new THREE.MeshStandardMaterial({ color: 0xc8d5de, roughness: .9 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xb0c4d1, roughness: .8 }),
    part: new THREE.MeshStandardMaterial({ color: 0x82d8ff, metalness: .15, roughness: .3 })
  };

  function box(parent, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent, top, bottom, height, position, material, rotate = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 24), material);
    mesh.position.set(...position);
    if (rotate) mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const building = new THREE.Group();
  scene.add(building);
  const presses = new Map();
  let selected;
  let rows = 2;
  let elapsed = 0;
  let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 1;
  let lastFrame = performance.now();

  function rebuildFloor(count) {
    building.traverse(object => {
      object.geometry?.dispose();
      if (object.isLineSegments) object.material.dispose();
    });
    building.clear();
    rows = Math.ceil(count / 3);
    const depth = rows * 7 + 6;
    box(building, [28, .35, depth], [0, -.2, 0], materials.floor);
    // Open walls preserve views into the factory from every orbit angle.
    box(building, [28, .65, .25], [0, .3, -depth / 2], materials.wall);
    box(building, [.25, .65, depth], [-14, .3, 0], materials.wall);
    const grid = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x718e9f, transparent: true, opacity: .23 })
    );
    const vertices = [];
    for (let x = -14; x <= 14; x++) vertices.push(x, .005, -depth / 2, x, .005, depth / 2);
    for (let z = -depth / 2; z <= depth / 2; z++) vertices.push(-14, .005, z, 14, .005, z);

    grid.geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    building.add(grid);
    for (let row = 0; row < rows; row++) {
      const z = (row - (rows - 1) / 2) * 7;
      for (const x of [-8, 0, 8]) {
        for (const side of [-1, 1]) {
          box(building, [6.9, .018, .065], [x, .02, z + side * 1.65], materials.yellow);
          box(building, [.065, .018, 3.3], [x + side * 3.45, .02, z], materials.yellow);
        }
      }
      if (row < rows - 1) {
        const aisleZ = z + 3.5;
        box(building, [26, .02, .065], [0, .025, aisleZ - .65], materials.yellow);
        box(building, [26, .02, .065], [0, .025, aisleZ + .65], materials.yellow);
        for (let x = -12; x <= 12; x += 2) {
          box(building, [.8, .025, .07], [x, .025, aisleZ], materials.wall);
        }
      }
    }
  }

  function createPress(station, index) {
    const group = new THREE.Group();
    group.userData.key = station.key;
    scene.add(group);
    box(group, [6, .8, 1.9], [0, .5, 0], materials.dark);
    for (const x of [-2.5, 2.5]) {
      box(group, [.6, .25, 2.15], [x, .1, 0], materials.dark);
    }
    for (const x of [-2.1, -.7, .8, 2.2]) {
      box(group, [1.2, .58, .03], [x, .5,  .97], materials.metal);
      box(group, [.2, .04, .04], [x + .32, .65, 1], materials.dark);
    }
    // A framed housing leaves the mold chamber visible during each cycle.
    box(group, [3.7, .22, 2], [-1.05, 2.35, 0], materials.blue);
    box(group, [3.7, .2, 2], [-1.05, 1, 0], materials.blue);
    box(group, [.4, 1.3, 2], [-2.7, 1.65, 0], materials.blue);
    box(group, [.28, 1.3, 2], [.65, 1.65, 0], materials.blue);
    box(group, [1.35, 1.1, .08], [-1.8, 1.68, 1.01], materials.window);
    box(group, [3.7, 1.25, .08], [-1.05, 1.7, -.98], materials.blue);
    for (const y of [1.22, 2.05]) {
      for (const z of [-.55, .55]) {
        cylinder(group, .045, .045, 2.5, [-.5, y, z], materials.metal, true);
      }
    }
    box(group, [.28, 1.02, 1.35], [.32, 1.65, 0], materials.metal);
    const clamp = box(group, [.28, 1.02, 1.35], [-.9, 1.65, 0], materials.metal);
    cylinder(group, .22, .22, 2.25, [1.55, 1.5, 0], materials.dark, true);
    box(group, [1.15, .95, 1.3], [2.5, 1.55, 0], materials.metal);
    for (let x = 2.12; x < 2.95; x += .13) {
      box(group, [.05, .65, .03], [x, 1.55, .665], materials.dark);
    }
    cylinder(group, .55, .15, .85, [1.3, 2.45, 0], materials.metal);
    cylinder(group, .15, .15, .45, [1.3, 1.9, 0], materials.metal);
    box(group, [.42, .82, .18], [.87, 1.85, 1.16], materials.dark);
    box(group, [.28, .36, .03], [.87, 2, 1.26], materials.screen);
    cylinder(group, .06, .06, .3, [.7, 2.62, .6], materials.dark);
    const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x7c8c99 });
    const lamp = cylinder(group, .09, .09, .15, [.7, 2.83, .6], lampMaterial);
    const part = box(group, [.12, .32, .35], [.06, 1.65, 0], materials.part);
    const outline = new THREE.BoxHelper(group, 0x54baff);
    outline.visible = false;
    scene.add(outline);
    const label = document.createElement("button");
    label.type = "button";
    label.className = "machine-label";
    const title = document.createElement("strong");
    title.textContent = station.label;
    const state = document.createElement("span");
    label.append(title, state);
    label.addEventListener("click", () => onSelect(station.key));
    labelLayer.append(label);
    return { group, clamp, lamp, part, outline, label, state, index };
  }

  function resetView() {
    const aspect = host.clientWidth / host.clientHeight;
    const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2),
      Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect));
    const radius = Math.hypot(14, (rows * 7 + 6) / 2);
    const distance = radius / Math.sin(halfFov) * 1.12;
    controls.maxDistance = Math.max(95, distance * 2);
    camera.far = Math.max(500, distance * 4);
    camera.updateProjectionMatrix();
    camera.position.set(.65, .68, .85).normalize().multiplyScalar(distance);
    controls.target.set(0, .7, 0);
    controls.update();
  }

  function zoom(factor) {
    camera.position.sub(controls.target).multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance).add(controls.target);
    controls.update();
  }

  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let pointerStart;
  canvas.addEventListener("pointerdown", event => {
    pointerStart = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
  });
  canvas.addEventListener("pointerup", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId || event.button !== 0 ||
        Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5 ||
        performance.now() - pointerStart.time > 600) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...presses.values()].map(press => press.group), true)[0];
    if (!hit) return;
    let object = hit.object;
    while (object && !object.userData.key) object = object.parent;
    if (object) onSelect(object.userData.key);
  });
  canvas.addEventListener("pointercancel", () => { pointerStart = null; });
  host.addEventListener("keydown", event => {
    if (event.target !== host && event.target !== canvas) return;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    switch (event.key) {
      case "ArrowLeft": spherical.theta -= .12; break;
      case "ArrowRight": spherical.theta += .12; break;
      case "ArrowUp": spherical.phi = Math.max(.1, spherical.phi - .1); break;
      case "ArrowDown": spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + .1); break;
      case "+": case "=": zoom(.85); event.preventDefault(); return;
      case "-": zoom(1.15); event.preventDefault(); return;
      default: return;
    }
    event.preventDefault();
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
  });

  new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }).observe(host);

  const projected = new THREE.Vector3();
  renderer.setAnimationLoop(now => {
    const delta = Math.min((now - lastFrame) / 1000, .1);
    lastFrame = now;
    if (playing) elapsed += delta * speed;
    controls.update();
    const labelPositions = [];
    for (const [key, press] of presses) {
      const phase = (elapsed / 8 + press.index * .17) % 1;
      const close = phase < .25 ? THREE.MathUtils.smoothstep(phase, 0, .25) :
        phase < .75 ? 1 : 1 - THREE.MathUtils.smoothstep(phase, .75, .88);
      press.clamp.position.x = -1.05 + close * 1.08;
      press.part.visible = phase > .5 && phase < .98;
      press.part.position.y = 1.65 - Math.max(0, phase - .86) * 12;
      press.outline.update();
      projected.copy(press.group.position).add(new THREE.Vector3(0, 3.4, 0)).project(camera);
      const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      press.label.hidden = !visible;
      if (visible) {
        const width = press.label.offsetWidth;
        const height = press.label.offsetHeight;
        labelPositions.push({
          label: press.label, width, height,
          x: THREE.MathUtils.clamp((projected.x + 1) * host.clientWidth / 2 - width / 2, 4, host.clientWidth - width - 4),
          y: (1 - projected.y) * host.clientHeight / 2 - height
        });
      }
      press.label.style.zIndex = String(Math.round((1 - projected.z) * 10000));
      if (key === selected) onPhase(phase);
    }
    const placed = [];
    for (const position of labelPositions.sort((a, b) => b.y - a.y)) {
      let overlap;
      do {
        overlap = placed.find(other =>
          position.x < other.x + other.width + 4 && position.x + position.width + 4 > other.x &&
          position.y < other.y + other.height + 4 && position.y + position.height + 4 > other.y);
        if (overlap) position.y = overlap.y - position.height - 5;
      } while (overlap);
      position.label.hidden = position.y < 0;
      position.label.style.transform = `translate(${position.x}px, ${position.y}px)`;
      placed.push(position);
    }
    renderer.render(scene, camera);
  });

  function setTheme(dark) {
    scene.background = new THREE.Color(dark ? 0x172a37 : 0xdce7ee);
    materials.floor.color.set(dark ? 0x486071 : 0xc8d5de);
    materials.wall.color.set(dark ? 0x344d60 : 0xa8bdcc);
  }
  setTheme(document.documentElement.dataset.theme === "dark");
  new MutationObserver(() => setTheme(document.documentElement.dataset.theme === "dark"))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    document.querySelector("#scene-error").hidden = false;
    document.querySelector("#scene-error").textContent = "The 3D view lost its graphics connection. Reload the page to restore it. Machine data remains available below.";
  });

  return {
    update(stations, selectedKey) {
      const keys = new Set(stations.map(station => station.key));
      for (const [key, press] of presses) {
        if (keys.has(key)) continue;
        press.group.traverse(object => {
          object.geometry?.dispose();
          if (object === press.lamp) object.material.dispose();
        });
        scene.remove(press.group, press.outline);
        press.outline.geometry.dispose();
        press.outline.material.dispose();
        press.label.remove();
        presses.delete(key);
      }
      const layoutChanged = presses.size !== stations.length;
      if (layoutChanged) rebuildFloor(stations.length);
      stations.forEach((station, index) => {
        if (!presses.has(station.key)) presses.set(station.key, createPress(station, index));
        const press = presses.get(station.key);
        press.index = index;
        press.group.position.set((index % 3 - 1) * 8, 0, (Math.floor(index / 3) - (rows - 1) / 2) * 7);
        press.state.textContent = station.status.text;
        press.label.dataset.state = station.status.kind;
        press.label.setAttribute("aria-label", `${station.label}, ${station.status.text}. Show machine details.`);
        press.lamp.material.color.set(station.status.kind === "ok" ? 0x3bb979 : station.status.kind === "stale" ? 0xe36650 : 0xc7a04e);
      });
      this.select(selectedKey);
      if (layoutChanged) resetView();
    },
    select(key) {
      selected = key;
      for (const [pressKey, press] of presses) {
        press.outline.visible = pressKey === selected;
        press.label.setAttribute("aria-pressed", String(pressKey === selected));
      }
    },
    setPlaying(value) { playing = value; },
    setSpeed(value) { speed = value; },
    resetView,
    zoom
  };
}
