import { useEffect, useRef, useState } from "react";
import { uploadIfc, fetchRulesets } from "../api/auditApi";
import { Upload, X } from "lucide-react";
import type { Ruleset } from "../types/audit";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadComplete: () => void;
}

function UploadDrawer({ isOpen, onClose, onUploadComplete }: UploadDrawerProps) {
    const [ifcFile, setIfcFile] = useState<File | null>(null)
    const [rulesetFile, setRulesetFile] = useState<File | null>(null);
    const [convertGlb, setConvertGlb] = useState(true)
    const [status, setStatus] = useState<UploadStatus>("idle")
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [rulesets, setRulesets] = useState<Ruleset[]>([]);
    const [selectedRulesetId, setSelectedRulesetId] = useState<string>("");

    const ifcInputRef = useRef<HTMLInputElement>(null);
    const rulesetInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        fetchRulesets()
            .then(setRulesets)
            .catch(() => setRulesets([]));
    })

    function handleDragOver(e: React.DragEvent) {
        e.preventDefault();
        setIsDragging(true);
    }

    function handleDragLeave(e: React.DragEvent) {
        e.preventDefault();
        setIsDragging(false);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".ifc")) {
            setErrorMsg("Only .ifc files are supported.");
            return;
        }

        setErrorMsg(null);
        setIfcFile(file);
    }

    function handleIfcClick() {
        ifcInputRef.current?.click();
    }

    async function handleUpload() {
        if (!ifcFile) return;

        setStatus("uploading");
        setErrorMsg(null);

        try {
            await uploadIfc(ifcFile, {
                rulesetFile: rulesetFile ?? undefined,
                rulesetId: selectedRulesetId ? Number(selectedRulesetId) : undefined,
                convertGlb,
            });
            setStatus("success");
            onUploadComplete();
            handleClose();
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Upload failed");
            setStatus("error");
        }
    }

    function handleClose() {
        setIfcFile(null);
        setRulesetFile(null);
        setConvertGlb(true);
        setStatus("idle");
        setErrorMsg(null);
        setIsDragging(false);
        setSelectedRulesetId("")
        if (ifcInputRef.current) ifcInputRef.current.value = "";
        if (rulesetInputRef.current) rulesetInputRef.current.value = "";
        onClose();
    }

    if (!isOpen) return null;

    return (
        <>
            <div className="drawer-overlay" onClick={handleClose} />

            <div className="drawer" role="dialog" aria-label="New Audit">
                <div className="drawer-header">
                    <div className="drawer-title">New Audit</div>
                    <button className="drawer-close btn btnSmall" onClick={handleClose}>
                        <X size={12} strokeWidth={4} />
                    </button>
                </div>

                <div className="drawer-body">
                    {/* IFC Drop Zone */}
                    <div
                        className={`drop-zone ${isDragging ? "drop-zone-active" : ""} ${ifcFile ? "drop-zone-filled" : ""}`}
                        onClick={handleIfcClick}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        role="button"
                        tabIndex={0}
                        aria-label="Upload IFC file"
                        onKeyDown={(e) => e.key === "Enter" && handleIfcClick()}
                    >
                        <Upload size={28} strokeWidth={1.5} className="drop-icon" />
                        {ifcFile ? (
                            <>
                                <div className="drop-label">{ifcFile.name}</div>
                                <div className="drop-sub">Click to replace</div>
                            </>
                        ) : (
                            <>
                                <div className="drop-label">Drop IFC file here</div>
                                <div className="drop-sub">or click to browse — .ifc only</div>
                            </>
                        )}
                        <input
                            ref={ifcInputRef}
                            type="file"
                            accept=".ifc"
                            style={{ display: "none" }}
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setIfcFile(file);
                                setErrorMsg(null);
                            }}
                        />
                    </div>

                    {/* Ruleset */}
                    <div className="drawer-field">
                        <div className="drawer-field-label">Ruleset</div>
                        <div className="drawer-field-sub">Select a ruleset or upload a custom JSON file</div>

                        <div className="ruleset-select-row">
                            <select
                                className="ruleset-select"
                                value={selectedRulesetId}
                                disabled={status === "uploading" || !!rulesetFile}
                                onChange={(e) => {
                                    setSelectedRulesetId(e.target.value);
                                    if (e.target.value && rulesetFile) {
                                        setRulesetFile(null);
                                        if (rulesetInputRef.current) rulesetInputRef.current.value = "";
                                    }
                                }}
                            >
                                <option value="">Use default ruleset</option>
                                {rulesets.map((rs) => (
                                    <option key={rs.id} value={rs.id}>
                                        {rs.name} ({rs.rule_count} rules)
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                className="ruleset-upload-btn btn btnSmall"
                                onClick={() => rulesetInputRef.current?.click()}
                                disabled={status === "uploading"}
                            >
                                Upload
                            </button>
                        </div>

                        <input
                            ref={rulesetInputRef}
                            type="file"
                            accept=".json"
                            style={{ display: "none" }}
                            disabled={status === "uploading"}
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setRulesetFile(file);
                                if (file) setSelectedRulesetId("");
                            }}
                        />

                        {rulesetFile && (
                            <div className="drop-sub" style={{ marginTop: 4 }}>{rulesetFile.name}</div>
                        )}
                    </div>

                    {/* GLB Toggle */}
                    <div className="drawer-field">
                        <div className="drawer-field-label">3D Model</div>
                        <div className="drawer-toggle-row">
                            <div
                                className={`toggle-track ${convertGlb ? "toggle-on" : ""}`}
                                onClick={() => setConvertGlb(!convertGlb)}
                                role="switch"
                                aria-checked={convertGlb}
                                tabIndex={0}
                                onKeyDown={(e) => e.key === "Enter" && setConvertGlb(!convertGlb)}
                            >
                                <div className="toggle-thumb" />
                            </div>
                            <span className="drawer-toggle-label">Include GLB conversion</span>
                        </div>
                    </div>

                    {/* Error */}
                    {status === "error" && errorMsg && (
                        <div className="state-message error" role="alert">
                            {errorMsg}
                        </div>
                    )}
                </div>

                <div className="drawer-footer">
                    <button
                        className="drawer-run-btn"
                        onClick={handleUpload}
                        disabled={!ifcFile || status === "uploading"}
                    >
                        {status === "uploading" ? "Auditing..." : "Run Audit"}
                    </button>
                </div>
            </div>
        </>
    )
}

export default UploadDrawer;