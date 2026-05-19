import { useRef, type ReactNode } from "react";
import { useSplitter } from "../hook/useSplitter";

interface DetailPanesProps {
    left: ReactNode;
    right: ReactNode;
}

function DetailPanes({ left, right }: DetailPanesProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const splitterRef = useRef<HTMLDivElement>(null);

    useSplitter(containerRef, splitterRef);

    return (
        <div className="detail-panes" ref={containerRef}>
            <div className="issues-pane">{left}</div>

            <div
            ref={splitterRef}
            className="splitter"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels">
            </div>

            <div className="viewer-pane">{right}</div>
        </div>
    );
}

export default DetailPanes;