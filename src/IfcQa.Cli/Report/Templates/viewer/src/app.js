import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

//#region state
const state = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,

  modelRoot: null,              // gltf.scene
  objectsByGlobalId: new Map(), // gid -> Mesh[]
  issuesByGid: new Map(),       // gid -> Issue[]

  hoveredGid: null,
  selectedGid: null,

  viewerInfo: null,

  originalMatState: new WeakMap(), // material -> saved values
  outlineMap: new WeakMap(),       // mesh -> LineSegments
};
//#endregion

//#region scratch
const visRaycaster = new THREE.Raycaster();
const tmpCenter = new THREE.Vector3();
//#endregion

//#region data
async function fetchIssues() {
  const res = await fetch("./issues.json");
  const data = await res.json();
  return data.Issues ?? data.issues ?? [];
}

function buildIssuesByGlobalId(issues) {
  const map = new Map();
  for (const it of issues) {
    const gid = it.GlobalId ?? it.globalId;
    if (!gid) continue;
    if (!map.has(gid)) map.set(gid, []);
    map.get(gid).push(it);
  }
  return map;
}
//#endregion

//#region model utils
function findNamedAncestor(obj) {
  let cur = obj;
  while (cur) {
    if (cur.name) return cur;
    cur = cur.parent;
  }
  return null;
}

function looksLikeIfcGuid(name) {
  return  typeof name === "string" && 
          name.length >= 20 &&
          name.length <= 30 &&
          /[A-Za-z0-9_$]/.test(name);
}

function indexMeshesByGuidNode() {
  state.objectsByGlobalId.clear();
  if (!state.modelRoot) return;

  state.modelRoot.traverse((node) => {
    if (!node.name) return;
    if (!looksLikeIfcGuid(node.name)) return;

    const gid = node.name;

    const meshes = [];
    node.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });

    if (meshes.length > 0) {
      const prev = state.objectsByGlobalId.get(gid);
      if (prev) prev.push(...meshes);
      else state.objectsByGlobalId.set(gid, meshes);
    }
  });
}


//#endregion

//#region camera
function simpleFit(sceneRoot, camera, controls) {
  const box = new THREE.Box3().setFromObject(sceneRoot);
  const center = box.getCenter(new THREE.Vector3());
  const sizeVec = box.getSize(new THREE.Vector3());
  const size = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);

  controls.target.copy(center);

  camera.near = Math.max(size / 1000, 0.01);
  camera.far = Math.max(size * 20, 1000);
  camera.updateProjectionMatrix();

  camera.position.set(
    center.x + size * 1.2,
    center.y + size * 0.8,
    center.z + size * 1.2
  );

  controls.update();
}
//#endregion

//#region highlight (fill)
function setFillHighlight(mesh, on) {
  if (!mesh?.isMesh) return;

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  for (const m of materials) {
    if (!m) continue;

    if (on) {
      if (!state.originalMatState.has(m)) {
        state.originalMatState.set(m, {
          hasColor: !!m.color,
          color: m.color ? m.color.clone() : null,
          hasEmissive: !!m.emissive,
          emissive: m.emissive ? m.emissive.clone() : null,
          emissiveIntensity: m.emissiveIntensity ?? 1,
        });
      }

      if (m.color) m.color.setHex(0xff6666);
      if (m.emissive) {
        m.emissive.setHex(0x330000);
        m.emissiveIntensity = 0.6;
      }
      m.needsUpdate = true;
    } else {
      const prev = state.originalMatState.get(m);
      if (!prev) continue;

      if (prev.hasColor && m.color && prev.color) m.color.copy(prev.color);
      if (prev.hasEmissive && m.emissive && prev.emissive) {
        m.emissive.copy(prev.emissive);
        m.emissiveIntensity = prev.emissiveIntensity;
      }
      m.needsUpdate = true;
    }
  }
}
//#endregion

//#region highlight (outline)
function ensureOutline(mesh) {
  if (state.outlineMap.has(mesh)) return state.outlineMap.get(mesh);

  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0xff6666,
    side: THREE.BackSide,
    depthTest: false,
    transparent: true,
    opacity: 0.75,
    // polygonOffset: true,
    // polygonOffsetFactor: 1,
    // polygonOffsetUnits: 1,
  });

  const outline = new THREE.Mesh(mesh.geometry, outlineMat);

  outline.frustumCulled = false;
  outline.renderOrder = 9999;
  outline.visible = false;

  outline.scale.set(1.05, 1.05, 1.05);

  mesh.add(outline);

  state.outlineMap.set(mesh, outline);
  return outline;
}

function setOutlineHighlight(mesh, on) {
  if (!mesh?.isMesh) return;
  const outline = ensureOutline(mesh);
  outline.visible = !!on;
}

//#endregion

//#region visibility test
function isMeshVisible(mesh, camera, sceneRoot) {
  const box = new THREE.Box3().setFromObject(mesh);
  box.getCenter(tmpCenter);

  const dir = tmpCenter.clone().sub(camera.position).normalize();
  visRaycaster.set(camera.position, dir);

  const dist = camera.position.distanceTo(tmpCenter);
  const hits = visRaycaster.intersectObject(sceneRoot, true);
  if (!hits.length) return true;

  const first = hits[0];
  if (first.distance > dist - 1e-3) return true;

  return first.object === mesh;
}
//#endregion

//#region hover
function clearHover() {
  if (!state.hoveredGid) return;
  if (state.hoveredGid === state.selectedGid) return;

  const meshes = state.objectsByGlobalId.get(state.hoveredGid) ?? [];
  for (const m of meshes) {
    setFillHighlight(m, false);
    setOutlineHighlight(m, false);
  }
  state.hoveredGid = null;
}

function hoverGlobalId(gid) {
  if (!state.modelRoot || state.objectsByGlobalId.size === 0) return;

  if (gid === state.hoveredGid) return;

  clearHover();

  if (!gid) return;
  if (gid === state.selectedGid) return;

  state.hoveredGid = gid;

  const meshes = state.objectsByGlobalId.get(gid) ?? [];
  if (meshes.length === 0) {
    state.viewerInfo && (state.viewerInfo.textContent = `${gid}\nNo geometry for this issue (type-level / non-geometric).`);
    return;
  }
  for (const m of meshes) {
    const visible = isMeshVisible(m, state.camera, state.modelRoot);
    if (visible) {
      setOutlineHighlight(m, false);
      setFillHighlight(m, true);
    } else {
      setFillHighlight(m, false);
      setOutlineHighlight(m, true);
    }
  }
}
//#endregion

//#region selection
function clearSelection() {
  if (!state.selectedGid) return;

  const prev = state.objectsByGlobalId.get(state.selectedGid) ?? [];
  for (const m of prev) {
    setFillHighlight(m, false);
    setOutlineHighlight(m, false);
  }

  state.selectedGid = null;
  showIssuesForGlobalId(null);
}

function showIssuesForGlobalId(gid) {
  if (!state.viewerInfo) return;

  if (!gid) {
    state.viewerInfo.textContent = "";
    return;
  }

  const list = state.issuesByGid.get(gid) ?? [];
  const header = `${gid} — ${list.length} issue(s)`;
  const lines = list.slice(0, 8).map((it) => `- [${it.Severity}] ${it.Message}`);
  state.viewerInfo.textContent = [header, ...lines].join("\n");
}

function selectGlobalId(gid) {
  if (!state.modelRoot || state.objectsByGlobalId.size === 0) return;

  // clear prior selection
  if (state.selectedGid) {
    const prev = state.objectsByGlobalId.get(state.selectedGid) ?? [];
    for (const m of prev) {
      setFillHighlight(m, false);
      setOutlineHighlight(m, false);
    }
  }

  state.selectedGid = gid;

  if (!gid) {
    showIssuesForGlobalId(null);
    return;
  }

  // selection wins over hover
  clearHover();

  const meshes = state.objectsByGlobalId.get(gid) ?? [];
  for (const m of meshes) setFillHighlight(m, true);

  showIssuesForGlobalId(gid);

  // focus later (click issue -> focus). keep disabled for now.
  // focusGlobalId(gid);
}
//#endregion

//#region canvas picking
function onCanvasPick(ev) {
  if (!state.modelRoot) return;

  const rect = state.renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, state.camera);

  const hits = raycaster.intersectObject(state.modelRoot, true);

  // click void -> clear selection
  if (!hits.length) {
    clearSelection();
    return;
  }

  const hitObj = hits[0].object;
  const named = findNamedAncestor(hitObj);
  const gid = named?.name ?? null;

  selectGlobalId(gid);
}
//#endregion

//#region app init
async function main() {
  const canvas = document.getElementById("viewerCanvas");
  if (!canvas) return;

  state.viewerInfo = document.getElementById("viewerInfo") ?? null;

  const issues = await fetchIssues();
  state.issuesByGid = buildIssuesByGlobalId(issues);

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  state.renderer.setPixelRatio(window.devicePixelRatio);

  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  state.camera.position.set(10, 10, 10);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.update();

  state.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(10, 20, 10);
  state.scene.add(dir);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    state.renderer.setSize(w, h, false);
    state.camera.aspect = w / h;
    state.camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // click vs drag guard
  let isDragging = false;
  let downPos = { x: 0, y: 0 };
  const DRAG_PX = 6;

  state.renderer.domElement.addEventListener("pointerdown", (e) => {
    isDragging = false;
    downPos = { x: e.clientX, y: e.clientY };
  });

  state.renderer.domElement.addEventListener("pointermove", (e) => {
    const dx = e.clientX - downPos.x;
    const dy = e.clientY - downPos.y;
    if (dx * dx + dy * dy > DRAG_PX * DRAG_PX) isDragging = true;
  });

  state.renderer.domElement.addEventListener("pointerup", (e) => {
    if (isDragging) return;
    if (e.button !== 0) return;
    onCanvasPick(e);
  });

  const loader = new GLTFLoader();
  loader.load(
    "./model.glb",
    (gltf) => {
      state.modelRoot = gltf.scene;
      state.scene.add(state.modelRoot);

      resize();
      simpleFit(state.modelRoot, state.camera, state.controls);

      indexMeshesByGuidNode();
    },
    undefined,
    (err) => console.error("Failed to load model.glb:", err)
  );

  function animate() {
    requestAnimationFrame(animate);
    state.renderer.render(state.scene, state.camera);
  }
  animate();

  window.addEventListener("ifcqa:hover", (e) => hoverGlobalId(e.detail?.gid ?? null));
  window.addEventListener("ifcqa:select", (e) => selectGlobalId(e.detail?.gid ?? null));
}

function hasNodeNamed(root, gid) {
  let found = false;
  root.traverse((obj) => {
    if (found) return;
    if (obj.name === gid) found = true;
  });
  return found;
}


main().catch(console.error);
//#endregion
