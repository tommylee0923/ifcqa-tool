import { useRef, useState } from "react";
import { uploadIfc } from "../api/auditApi";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadFormProps {
    onUploadComplete: () => void;
}

function UploadForm({ onUploadComplete }: UploadFormProps) {
    const [ifcFile, setIfcFile] = useState<File | null>(null);
    const [rulesetFile, setRulesetFile] = useState<File | null>(null);
    const [convertGlb, setConvertGlb] = useState(true)
    const [status, setStatus] = useState<UploadStatus>("idle")
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [result, setResult] = useState<{ run_id: number; total_elements: number; total_issues: number } | null>(null);

    const ifcInputRef = useRef<HTMLInputElement>(null);
    const rulesetInputRef = useRef<HTMLInputElement>(null);

    async function handleUpload() {
        if (!ifcFile) return;

        setStatus("uploading");
        setErrorMsg(null);
        setResult(null);

        try {
            const data = await uploadIfc(ifcFile, {
                rulesetFile: rulesetFile ?? undefined,
                convertGlb,
            });
            setResult(data);
            setStatus("success");
            onUploadComplete();
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Upload failed");
            setStatus("error");
        }
    }

    function handleReset() {
        setIfcFile(null);
        setRulesetFile(null);
        setConvertGlb(true);
        setStatus("idle");
        setErrorMsg(null);
        setResult(null);
        if (ifcInputRef.current) ifcInputRef.current.value = "";
        if (rulesetInputRef.current) rulesetInputRef.current.value = "";
    }

    return (
        <div className="card upload-form">
            <div className="upload-form-title">Upload IFC Model</div>

            <div className="upload-row">
                <label className="upload-label">
                    IFC File <span className="required">*</span>
                </label>
                <input
                    ref={ifcInputRef}
                    type="file"
                    accept=".ifc"
                    onChange={(e) => setIfcFile(e.target.files?.[0] ?? null)}
                    disabled={status === "uploading"}
                />
            </div>

            <div className="upload-row">
                <label className="upload-label">
                    Ruleset <span className="optional">(optional — defaults to revit-export)</span>
                </label>
                <input
                    ref={rulesetInputRef}
                    type="file"
                    accept=".json"
                    onChange={(e) => setRulesetFile(e.target.files?.[0] ?? null)}
                    disabled={status === "uploading"}
                />
            </div>

            <div className="upload-row upload-row-inline">
                <input
                    id="convert-glb"
                    type="checkbox"
                    checked={convertGlb}
                    onChange={(e) => setConvertGlb(e.target.checked)}
                    disabled={status === "uploading"}
                />
                <label htmlFor="convert-glb">Include 3D model (GLB conversion)</label>
            </div>

            <div className="upload-actions">
                <button
                    className="btn"
                    onClick={handleUpload}
                    disabled={!ifcFile || status === "uploading"}
                >
                    {status === "uploading" ? "Auditing..." : "Run Audit"}
                </button>

                {status !== "idle" && (
                    <button className="btn btnSmall" onClick={handleReset}>
                        Reset
                    </button>
                )}
            </div>

            {status === "success" && result && (
                <div className="state-message success">
                    Audit complete — {result.total_elements} elements, {result.total_issues} issues.
                </div>
            )}

            {status === "error" && errorMsg && (
                <div className="state-message error" role="alert">
                    {errorMsg}
                </div>
            )}
        </div>
    )
}

export default UploadForm;