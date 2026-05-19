import { useEffect, type RefObject } from "react";

const STORAGE_KEY = "ifcqa:leftW";
const MIN_PANE_WIDTH = 320;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function notifyViewerResize(): void {
    if (typeof window.resizeViewer === "function") {
        window.resizeViewer();
    }
}

export function useSplitter(
    containerRef: RefObject<HTMLDivElement | null>,
    splitterRef: RefObject<HTMLDivElement | null>
): void {
    useEffect(() => {
        const container = containerRef.current;
        const splitter = splitterRef.current;
        if (!container || !splitter) {
            return;
        }

        const root = document.documentElement;

        const saved = Number(localStorage.getItem(STORAGE_KEY));
        if (!Number.isNaN(saved) && saved > 0) {
            root.style.setProperty("--leftW", `${saved}px`);
        }

        let dragging = false;

        function setLeftWidthFromPoitner(clientX: number): void {
            const rect = container.getBoundingClientRect();
            const min = MIN_PANE_WIDTH;
            const max = Math.max(min + 50, rect.width - MIN_PANE_WIDTH);

            const localX = clientX - rect.left;
            const nextW = clamp(localX, min, max);

            root.style.setProperty("--leftW", `${nextW}px`);
            notifyViewerResize();
        }

        function onPointerDown(event: PointerEvent): void {
            event.preventDefault();
            dragging = true;
            splitter.setPointerCapture(event.pointerId);
            document.body.classList.add("resizing");
            document.body.classList.add("no-select");
        }

        function onPointerMove(event: PointerEvent): void {
            if (!dragging) {
                return;
            }
            event.preventDefault();
            setLeftWidthFromPoitner(event.clientX);
        }

        function endDrag(event: PointerEvent): void {
            if (!dragging) {
                return;
            }
            dragging = false;

            document.body.classList.remove("resizing");
            document.body.classList.remove("no-select");

            const currentWidth = parseFloat(getComputedStyle(root).getPropertyValue("--leftW")) || 520;
            localStorage.setItem(STORAGE_KEY, String(Math.round(currentWidth)));

            try {
                splitter.releasePointerCapture(event.pointerId);
            } catch {
                // pointer may already be released
            }
            notifyViewerResize();
        }

        function onWindowResize(): void {
            const rect = container.getBoundingClientRect();
            const current = parseFloat(getComputedStyle(root).getPropertyValue("--leftW")) || 520;

            const min = MIN_PANE_WIDTH;
            const max = Math.max(min + 50, rect.width - MIN_PANE_WIDTH);
            const clamped = clamp(current, min, max);

            root.style.setProperty("--leftW", `${clamped}px`);
            notifyViewerResize();
        }

        splitter.addEventListener("pointerdown", onPointerDown);
        splitter.addEventListener("pointermove", onPointerMove);
        splitter.addEventListener("pointerup", endDrag);
        splitter.addEventListener("pointercancel", endDrag);
        window.addEventListener("resize", onWindowResize);

        return () => {
            splitter.removeEventListener("pointerdown", onPointerDown);
            splitter.removeEventListener("pointermove", onPointerMove);
            splitter.removeEventListener("pointerup", endDrag);
            splitter.removeEventListener("pointercancel", endDrag);
            window.removeEventListener("resize", onWindowResize);
        };
    }, [containerRef, splitterRef]);
}