import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AuditRun } from "../types/audit";
import type { IfcqaHoverEvent, IfcqaSelectEvent } from "../types/ifcqaEvent";

// ============================================================
// #region STATE
// ============================================================
const viewerState = {
    renderer: null,
    scene: null,
    camera: null,
    controls: null,

    modelRoot: null,                // gltf scene
    objectsByGlobalId: new Map(),   // gid -> mesh[]
    issuesByGid: new Map(),         // gid -> Issue[]

    hoveredGid: null,
    selectedGid: null,

    viewerInfo: null,

    originalMatState: new WeakMap(),// material -> saved values
    outlineMap: new WeakMap(),      // mesh -> LineSegments

    currentRunId: null,
};
// #endregion

// ============================================================
// #region SCRATCH
// ============================================================
const visRaycaster = new THREE.Raycaster();
const tmpCenter = new THREE.Vector3();
// #endregion

// ============================================================
// #region DATA
// ============================================================
async function fetchIssues(runId) {
    const res = await fetch(`/runs/${runId}/issues`);
    if (!res.ok) throw new Error(`Failed to fetch issues for run ${runId}`);
    const data = await res.json();
    return data;
}

function buildIssuesByGlobalId(issues) {
    const map = new Map();
    for (const i of issues) {
        const gid = i.global_id ?? i.GlobalId ?? i.globalId;
        if (!gid) continue;
        if (!map.has(gid)) map.set(gid, []);
        map.get(gid).push(i);
    }
    return map;
}
// #endregion

// ============================================================
// #region MODEL UTILS
// ============================================================
function findNamedAncestor(obj) {
    let cur = obj;
    while (cur) {
        if (cur.name) return cur;
        cur = cur.parent;
    }
    return null;
}

function looksLikeIfcGuid(name) {
    return typeof name === "string" &&
        name.length >= 20 &&
        name.length <= 30 &&
        /[A-Za-z0-9_$]/.test(name);
}

function indexMeshesByGuidNode() {
    viewerState.objectsByGlobalId.clear();
    if (!viewerState.modelRoot) return;

    viewerState.modelRoot.traverse((node) => {
        if (!node.name) return;
        if (!looksLikeIfcGuid(node.name)) return;

        const gid = node.name;
        const meshes = [];
        node.traverse((child) => {
            if (child.isMesh) meshes.push(child);
        });

        if (meshes.length > 0) {
            const prev = viewerState.objectsByGlobalId.get(gid);
            if (prev) prev.push(...meshes);
            else viewerState.objectsByGlobalId.set(gid, meshes);
        }
    });
}
// #endregion

// ============================================================
// #region CAMERA
// ============================================================
function simpleFit(sceneRoot, camera, controls) {
    const box = new THREE.Box3().setFromObject(sceneRoot);

    if (box.isEmpty()) {
        console.warn("simpleFit: model bounding box is empty");
        return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const sizeVec = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fitDist = (maxDim * 0.75) / Math.tan(fov / 2);

    camera.near = Math.max(maxDim / 1000, 0.01);
    camera.far = Math.max(fitDist * 20, 10000);
    camera.updateProjectionMatrix();

    camera.position.copy(
        center.clone().add(new THREE.Vector3(fitDist, fitDist * 0.6, fitDist))
    );

    controls.target.copy(center);
    camera.lookAt(center);
    controls.update();

    console.log("BBox center:", center);
    console.log("BBox size:", sizeVec);
    console.log("Camera pos:", camera.position);
}
// #endregion

// ============================================================
// #region GROUND PLANE
// ============================================================
let ground = null;

function ensureGround(scene) {
    if (ground) return ground;

    const geo = new THREE.PlaneGeometry(5000, 5000);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x7CBA68,
        roughness: 1.0,
        metalness: 0.0,
    });
    mat.side = THREE.DoubleSide;

    ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.renderOrder = -1;
    scene.add(ground);

    return ground;
}
// #endregion

// ============================================================
// #region HIGHLIGHT — FILL
// ============================================================
function setFillHighlight(mesh, on) {
    if (!mesh?.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const m of materials) {
        if (!m) continue;

        if (on) {
            if (!viewerState.originalMatState.has(m)) {
                viewerState.originalMatState.set(m, {
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
            const prev = viewerState.originalMatState.get(m);
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
// #endregion

// ============================================================
// #region HIGHLIGHT — OUTLINE
// ============================================================
function ensureOutline(mesh) {
    if (viewerState.outlineMap.has(mesh)) return viewerState.outlineMap.get(mesh);

    const outlineMat = new THREE.MeshBasicMaterial({
        color: 0xff6666,
        side: THREE.BackSide,
        depthTest: false,
        transparent: true,
        opacity: 0.75,
    });

    const outline = new THREE.Mesh(mesh.geometry, outlineMat);
    outline.frustumCulled = false;
    outline.renderOrder = 9999;
    outline.visible = false;
    outline.scale.set(1.05, 1.05, 1.05);

    mesh.add(outline);
    viewerState.outlineMap.set(mesh, outline);
    return outline;
}

function setOutlineHighlight(mesh, on) {
    if (!mesh?.isMesh) return;
    const outline = ensureOutline(mesh);
    outline.visible = !!on;
}
// #endregion

// ============================================================
// #region VISIBILITY TEST
// ============================================================
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
// #endregion

// ============================================================
// #region HOVER
// ============================================================
function clearHover() {
    if (!viewerState.hoveredGid) return;
    if (viewerState.hoveredGid === viewerState.selectedGid) return;

    const meshes = viewerState.objectsByGlobalId.get(viewerState.hoveredGid) ?? [];
    for (const m of meshes) {
        setFillHighlight(m, false);
        setOutlineHighlight(m, false);
    }
    viewerState.hoveredGid = null;
}

function hoverGlobalId(gid) {
    if (!viewerState.modelRoot || viewerState.objectsByGlobalId.size === 0) return;
    if (gid === viewerState.hoveredGid) return;

    clearHover();
    if (!gid) return;
    if (gid === viewerState.selectedGid) return;

    viewerState.hoveredGid = gid;

    const meshes = viewerState.objectsByGlobalId.get(gid) ?? [];
    if (meshes.length === 0) return;

    for (const m of meshes) {
        const visible = isMeshVisible(m, viewerState.camera, viewerState.modelRoot);
        if (visible) {
            setOutlineHighlight(m, false);
            setFillHighlight(m, true);
        } else {
            setFillHighlight(m, false);
            setOutlineHighlight(m, true);
        }
    }
}
// #endregion

// ============================================================
// #region SELECTION
// ============================================================
function clearSelection() {
    if (!viewerState.selectedGid) return;

    const prev = viewerState.objectsByGlobalId.get(viewerState.selectedGid) ?? [];
    for (const m of prev) {
        setFillHighlight(m, false);
        setOutlineHighlight(m, false);
    }

    viewerState.selectedGid = null;
    showIssuesForGlobalId(null);
}

function showIssuesForGlobalId(gid) {
    if (!viewerState.viewerInfo) return;

    if (!gid) {
        viewerState.viewerInfo.textContent = "";
        return;
    }

    const list = viewerState.issuesByGid.get(gid) ?? [];
    const header = `${gid} — ${list.length} issue(s)`;
    const lines = list.slice(0, 8).map(
        (it) => `- [${it.severity ?? it.Severity}] ${it.message ?? it.Message}`
    );
    viewerState.viewerInfo.textContent = [header, ...lines].join("\n");
}

function selectGlobalId(gid) {
    if (!viewerState.modelRoot || viewerState.objectsByGlobalId.size === 0) return;

    if (viewerState.selectedGid) {
        const prev = viewerState.objectsByGlobalId.get(viewerState.selectedGid) ?? [];
        for (const m of prev) {
            setFillHighlight(m, false);
            setOutlineHighlight(m, false);
        }
    }

    viewerState.selectedGid = gid;

    if (!gid) {
        showIssuesForGlobalId(null);
        return;
    }

    clearHover();

    const meshes = viewerState.objectsByGlobalId.get(gid) ?? [];
    for (const m of meshes) setFillHighlight(m, true);

    showIssuesForGlobalId(gid);
}
// #endregion

// ============================================================
// #region CANVAS PICKING
// ============================================================
function onCanvasPick(ev) {
    if (!viewerState.modelRoot) return;

    const rect = viewerState.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, viewerState.camera);

    const hits = raycaster.intersectObject(viewerState.modelRoot, true);

    if (!hits.length) {
        clearSelection();
        return;
    }

    const hitObj = hits[0].object;
    const named = findNamedAncestor(hitObj);
    const gid = named?.name ?? null;

    selectGlobalId(gid);
}
// #endregion

// ============================================================
// #region INIT
// ============================================================
export function initViewer(canvas: HTMLCanvasElement): () => void {
    if (!canvas) return () => { };

    viewerState.viewerInfo = document.getElementById("viewerInfo") ?? null;

    viewerState.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    viewerState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewerState.renderer.setClearColor(0xb9d9ff, 1);

    viewerState.scene = new THREE.Scene();
    viewerState.scene.fog = new THREE.Fog(0xb9d9ff, 200, 2000);

    viewerState.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    viewerState.camera.position.set(10, 10, 10);

    viewerState.controls = new OrbitControls(
        viewerState.camera,
        viewerState.renderer.domElement
    );
    viewerState.controls.update();

    // Lighting
    const hemi = new THREE.HemisphereLight(0xb9d9ff, 0xd9d9d9, 0.9);
    viewerState.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 120, 80);
    viewerState.scene.add(dir);

    function resize() {
        const host = canvas.parentElement;
        const w = Math.max(1, host?.clientWidth ?? canvas.clientWidth);
        const h = Math.max(1, host?.clientHeight ?? canvas.clientHeight);
        viewerState.renderer.setSize(w, h, false);
        viewerState.camera.aspect = w / h;
        viewerState.camera.updateProjectionMatrix();
    }

    window.addEventListener("resize", resizeViewer);
    requestAnimationFrame(resize);

    // Click vs drag guard
    let isDragging = false;
    let downPos = { x: 0, y: 0 };
    const DRAG_PX = 6;

    viewerState.renderer.domElement.addEventListener("pointerdown", (e) => {
        isDragging = false;
        downPos = { x: e.clientX, y: e.clientY };
    });

    viewerState.renderer.domElement.addEventListener("pointermove", (e) => {
        const dx = e.clientX - downPos.x;
        const dy = e.clientY - downPos.y;
        if (dx * dx + dy * dy > DRAG_PX * DRAG_PX) isDragging = true;
    });

    viewerState.renderer.domElement.addEventListener("pointerup", (e) => {
        if (isDragging) return;
        if (e.button !== 0) return;
        onCanvasPick(e);
    });

    // Custom events — named handlers so we can remove them on cleanup
    const onHoverEvent = (e: Event) => {
        const event = e as IfcqaHoverEvent;
        hoverGlobalId(event.detail?.gid ?? null);
    };

    const onSelectEvent = (e: Event) => {
        const event = e as IfcqaSelectEvent;
        selectGlobalId(event.detail?.gid ?? null);
    };

    window.addEventListener("ifcqa:hover", onHoverEvent);
    window.addEventListener("ifcqa:select", onSelectEvent);

    // Render loop
    function animate() {
        requestAnimationFrame(animate);
        viewerState.renderer.render(viewerState.scene, viewerState.camera);
    }
    animate();

    return () => {
        window.removeEventListener("resize", resizeViewer);
        window.removeEventListener("ifcqa:hover", onHoverEvent);
        window.removeEventListener("ifcqa:select", onSelectEvent);
    };
}

function resizeViewer() {
    const canvas = document.getElementById("viewerCanvas");
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;

    if (!width || !height) {
        console.warn("resizeViewer: parent has zero size", { width, height });
        return;
    }

    viewerState.camera.aspect = width / height;
    viewerState.camera.updateProjectionMatrix();

    viewerState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewerState.renderer.setSize(width, height, false);
}
// #endregion

// ============================================================
// #region LOAD RUN  ← called by app.js when a run is opened
// ============================================================
function getGlbFilename(run: AuditRun): string {
    if (run.glb_filename) {
        return run.glb_filename;
    }
    const base = run.source_file.split(/[/\\]/).pop() ?? "model";
    return base.replace(/\.ifc$/i, "") + ".glb";
}

type LoadRunCallbacks = {
    onSuccess?: () => void;
    onError?: (message: string) => void;
}

async function loadRun(run: AuditRun, callbacks?: LoadRunCallbacks) {
    const filename = getGlbFilename(run);
    const url = `/model/${filename}`;

    if (viewerState.currentRunId === run.id) return;
    viewerState.currentRunId = run.id;

    // Fetch issues for this run and index by global_id
    try {
        const issues = await fetchIssues(run.id);
        viewerState.issuesByGid = buildIssuesByGlobalId(issues);
    } catch (e) {
        console.warn("viewer: could not load issues", e);
    }

    if (viewerState.modelRoot) {
        viewerState.scene.remove(viewerState.modelRoot);
        viewerState.modelRoot.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
        viewerState.modelRoot = null;
    }

    const loader = new GLTFLoader();
    loader.load(
        url,
        (gltf) => {
            viewerState.modelRoot = gltf.scene;
            viewerState.scene.add(viewerState.modelRoot);

            const box = new THREE.Box3().setFromObject(viewerState.modelRoot);

            simpleFit(viewerState.modelRoot, viewerState.camera, viewerState.controls);
            indexMeshesByGuidNode();

            const minY = box.min.y;
            const g = ensureGround(viewerState.scene);
            g.position.y = minY - 0.5;
            callbacks?.onSuccess?.();
        },
        undefined,
        () => {
            callbacks?.onError?.(
                `Could not load ${filename}. Run audit with --viewer and check output/.`
            );
        }
    );
}
// #endregion

// ============================================================
// #region EXPOSE TO WINDOW
// ============================================================
window.loadRun = loadRun;
window.hoverGlobalId = hoverGlobalId;
window.selectGlobalId = selectGlobalId;
window.resizeViewer = resizeViewer;
// #endregion

export { loadRun, resizeViewer, hoverGlobalId, selectGlobalId };