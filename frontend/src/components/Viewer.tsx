import { useEffect, useRef, useState } from "react";
import type { AuditRun } from "../types/audit";
import { initViewer, loadRun, resizeViewer } from "../viewer/viewer";

interface ViewerProps {
    run: AuditRun | null;
}

function Viewer({ run }: ViewerProps) {
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const cleanup = initViewer(canvas);

        requestAnimationFrame(() => {
            resizeViewer();
        })

        return cleanup;
    }, []);

    useEffect(() => {
        if (!run) {
            setStatusMessage(null);
            return;
        }
        setStatusMessage(null); // clear old message before new load
        loadRun(run, {
            onSuccess: () => setStatusMessage(null),
            onError: (message) => setStatusMessage(message),
        });
        requestAnimationFrame(() => resizeViewer());
    }, [run]);

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
            }}
        >
            <canvas ref={canvasRef} id="viewerCanvas" />

            {statusMessage !== null && (
                <div
                    className="state-message"
                    style={{
                        position: "absolute",
                        top: 16,
                        left: 16,
                        right: 16,
                        zIndex: 1,
                    }}
                >
                    {statusMessage}
                </div>
            )}
        </div>
    );
}

export default Viewer;