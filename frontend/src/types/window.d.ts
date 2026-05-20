export {}

declare global {
    interface Window {
        resizeViewer?: () => void;
        loadRun?: (run: import("./audit").AuditRun) => void;
        hoverGlobalId?:(gid: string | null) => void;
        selectGlobalId?: (gid: string | null) => void;
    }
}