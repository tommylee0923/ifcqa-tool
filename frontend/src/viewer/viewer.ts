import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AuditIssue, AuditRun } from "../types/audit";
import type { IfcqaHoverEvent, IfcqaSelectEvent } from "../types/ifcqaEvent";

// ============================================================
// #region STATE
// ============================================================
type HighlightableMaterial = THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
};

interface OriginalMaterialState {
    hasColor: boolean;
    color: THREE.Color | null;
    hasEmissive: boolean;
    emissive: THREE.Color | null;
    emissiveIntensity: number;
}

interface ViewerState {
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    controls: OrbitControls | null;

    modelRoot: THREE.Group | null;
    objectsByGlobalId: Map<string, THREE.Mesh[]>;
    issuesByGid: Map<string, AuditIssue[]>;

    hoveredGid: string | null;
    selectedGid: string | null;

    viewerInfo: HTMLElement | null;

    originalMatState: WeakMap<HighlightableMaterial, OriginalMaterialState>;
    outlineMap: WeakMap<THREE.Mesh, THREE.Mesh>;

    currentRunId: number | null;
    animationFrameId: number | null;

    groundPlane: THREE.Mesh | null;
}

const viewerState: ViewerState = {
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

    originalMatState: new WeakMap<HighlightableMaterial, OriginalMaterialState>(),// material -> saved values
    outlineMap: new WeakMap<THREE.Mesh, THREE.Mesh>(),      // mesh -> LineSegments

    currentRunId: null,
    animationFrameId: null,
    groundPlane: null
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
async function fetchIssues(runId: number) {
    const res = await fetch(`/runs/${runId}/issues`);
    if (!res.ok) throw new Error(`Failed to fetch issues for run ${runId}`);
    const data = await res.json();
    return data;
}

function buildIssuesByGlobalId(issues: AuditIssue[]) {
    const map = new Map();
    for (const i of issues) {
        const gid = i.global_id;
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
function findNamedAncestor(
    obj: THREE.Object3D | null
): THREE.Object3D | null {
    let cur = obj;
    while (cur) {
        if (cur.name) return cur;
        cur = cur.parent;
    }
    return null;
}

function looksLikeIfcGuid(name: string): boolean {
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
        const meshes: THREE.Mesh[] = [];
        node.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
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
function simpleFit(
    sceneRoot: THREE.Object3D,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls): void {
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
let ground: THREE.Mesh | null = null;

function ensureGround(scene: THREE.Scene) {
    if (
        viewerState.groundPlane &&
        viewerState.groundPlane.parent === scene
    ) {
        return viewerState.groundPlane;
    }

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
function setFillHighlight(mesh: THREE.Mesh, on: boolean) {
    if (!mesh?.isMesh) return;

    const materials = (
        Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    ) as HighlightableMaterial[];

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
function ensureOutline(mesh: THREE.Mesh): THREE.Mesh {
    const existing = viewerState.outlineMap.get(mesh);

    if (existing) {
        return existing;
    }

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

function setOutlineHighlight(mesh: THREE.Mesh, on: boolean) {
    if (!mesh?.isMesh) return;
    const outline = ensureOutline(mesh);
    outline.visible = !!on;
}
// #endregion

// ============================================================
// #region VISIBILITY TEST
// ============================================================
function isMeshVisible(
    mesh: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    sceneRoot: THREE.Object3D
): boolean {
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

function hoverGlobalId(gid: string | null): void {
    if (!viewerState.modelRoot || viewerState.objectsByGlobalId.size === 0 || !viewerState.camera) return;
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
function clearSelection(): void {
    if (!viewerState.selectedGid) return;

    const prev = viewerState.objectsByGlobalId.get(viewerState.selectedGid) ?? [];
    for (const m of prev) {
        setFillHighlight(m, false);
        setOutlineHighlight(m, false);
    }

    viewerState.selectedGid = null;
    showIssuesForGlobalId(null);
}

function showIssuesForGlobalId(gid: string | null): void {
    if (!viewerState.viewerInfo) return;

    if (!gid) {
        viewerState.viewerInfo.textContent = "";
        return;
    }

    const list = viewerState.issuesByGid.get(gid) ?? [];
    const header = `${gid} — ${list.length} issue(s)`;
    const lines = list.slice(0, 8).map(
        (it) => `- [${it.severity}] ${it.message}`
    );
    viewerState.viewerInfo.textContent = [header, ...lines].join("\n");
}

function selectGlobalId(gid: string | null): void {
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
function onCanvasPick(ev: MouseEvent) {
    if (!viewerState.modelRoot || !viewerState.renderer || !viewerState.camera) return;

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
    disposeViewer();
    if (!canvas) return () => { };

    viewerState.viewerInfo = document.getElementById("viewerInfo") ?? null;

    viewerState.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    viewerState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewerState.renderer.setClearColor(0xb9d9ff, 1);

    viewerState.scene = new THREE.Scene();
    viewerState.scene.fog = new THREE.Fog(0xb9d9ff, 200, 1000);

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

    function resize(): void {
        if (!viewerState.renderer || !viewerState.camera) return;
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

    viewerState.renderer.domElement.addEventListener("pointerdown", (e: MouseEvent) => {
        isDragging = false;
        downPos = { x: e.clientX, y: e.clientY };
    });

    viewerState.renderer.domElement.addEventListener("pointermove", (e: MouseEvent) => {
        const dx = e.clientX - downPos.x;
        const dy = e.clientY - downPos.y;
        if (dx * dx + dy * dy > DRAG_PX * DRAG_PX) isDragging = true;
    });

    viewerState.renderer.domElement.addEventListener("pointerup", (e: MouseEvent) => {
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
        viewerState.animationFrameId = requestAnimationFrame(animate);

        if (!viewerState.renderer || !viewerState.scene || !viewerState.camera) {
            return;
        }

        viewerState.controls?.update();
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
    if (!viewerState.scene || !viewerState.renderer || !viewerState.camera) return;
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
    if (!viewerState.scene || !viewerState.camera) return;

    const filename = getGlbFilename(run);
    const url = `${import.meta.env.BASE_URL}model/${filename}`;

    if (
        viewerState.currentRunId === run.id &&
        viewerState.modelRoot &&
        viewerState.scene
    ) {
        return;
    }

    // Fetch issues for this run and index by global_id
    try {
        const issues = await fetchIssues(run.id);
        viewerState.issuesByGid = buildIssuesByGlobalId(issues);
    } catch (e) {
        console.warn("viewer: could not load issues", e);
    }

    if (viewerState.modelRoot) {
        viewerState.scene.remove(viewerState.modelRoot);
        viewerState.modelRoot.traverse((obj: THREE.Object3D) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();

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
            if (!viewerState.scene || !viewerState.camera || !viewerState.controls) return;
            viewerState.modelRoot = gltf.scene;
            viewerState.scene.add(viewerState.modelRoot);

            const box = new THREE.Box3().setFromObject(viewerState.modelRoot);

            simpleFit(viewerState.modelRoot, viewerState.camera, viewerState.controls);
            indexMeshesByGuidNode();

            const minY = box.min.y;
            const g = ensureGround(viewerState.scene);
            g.position.y = minY - 0.5;
            callbacks?.onSuccess?.();
            viewerState.currentRunId = run.id;
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
// #region DISPOSE VIEWER
// ============================================================

export function disposeViewer() {
    if (viewerState.animationFrameId !== null) {
        cancelAnimationFrame(viewerState.animationFrameId);
        viewerState.animationFrameId = null;
    }

    viewerState.controls?.dispose();

    if (viewerState.modelRoot) {
        viewerState.modelRoot.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();

                const materials = Array.isArray(obj.material)
                    ? obj.material
                    : [obj.material];

                materials.forEach((m) => m.dispose());
            }
        });
    }

    viewerState.renderer?.dispose();

    viewerState.scene?.clear();

    viewerState.renderer = null;
    viewerState.scene = null;
    viewerState.camera = null;
    viewerState.controls = null;
    viewerState.modelRoot = null;
    viewerState.currentRunId = null;
    viewerState.groundPlane = null;

    viewerState.objectsByGlobalId.clear();
    viewerState.issuesByGid.clear();
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