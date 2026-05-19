export {}

declare global {
    interface Window {
        resizeViewer?: () => void;
    }
}