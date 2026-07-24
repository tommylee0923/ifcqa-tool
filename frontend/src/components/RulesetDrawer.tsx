import { useEffect, useState } from "react";
import { X, ChevronLeft, Sparkles } from "lucide-react";
import type { Ruleset } from "../types/audit";
import { fetchRulesets, fetchRuleset, composeRuleset } from "../api/auditApi";

type DrawerView = "list" | "detail" | "compose";

interface RulesetDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

function severityClass(severity: string): string {
    if (severity === "Error") return "sev Error";
    if (severity === "Warning") return "sev Warning";
    if (severity === "Info") return "sev Info";
    return "sev unknown";
}

function RulesetDrawer({ isOpen, onClose }: RulesetDrawerProps) {
    const [view, setView] = useState<DrawerView>("list");
    const [rulesets, setRulesets] = useState<Ruleset[]>([]);
    const [selectedRuleset, setSelectedRuleset] = useState<Ruleset | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Compose form state
    const [composeName, setComposeName] = useState("");
    const [composeDescription, setComposeDescription] = useState("");
    const [composeStatus, setComposeStatus] = useState<"idle" | "loading" | "error">("idle");
    const [composeError, setComposeError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        loadRulesets();
    }, [isOpen]);

    async function loadRulesets() {
        try {
            setIsLoading(true);
            setError(null);
            const data = await fetchRulesets();
            setRulesets(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load rulesets");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSelectRuleset(id: number) {
        try {
            setIsLoading(true);
            setError(null);
            const data = await fetchRuleset(id);
            setSelectedRuleset(data);
            setView("detail");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load ruleset");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCompose() {
        if (!composeName.trim() || !composeDescription.trim()) return;

        setComposeStatus("loading");
        setComposeError(null);

        try {
            await composeRuleset(composeName.trim(), composeDescription.trim());
            // Reset form, reload list, return to list view
            setComposeName("");
            setComposeDescription("");
            setComposeStatus("idle");
            await loadRulesets();
            setView("list");
        } catch (err) {
            setComposeError(err instanceof Error ? err.message : "Generation failed");
            setComposeStatus("error");
        }
    }

    function handleBack() {
        if (view === "detail") {
            setView("list");
            setSelectedRuleset(null);
        } else if (view === "compose") {
            setComposeName("");
            setComposeDescription("");
            setComposeStatus("idle");
            setComposeError(null);
            setView("list");
        }
    }

    function handleClose() {
        setView("list");
        setSelectedRuleset(null);
        setError(null);
        setComposeName("");
        setComposeDescription("");
        setComposeStatus("idle");
        setComposeError(null);
        onClose();
    }

    function drawerTitle() {
        if (view === "list") return "Rulesets";
        if (view === "detail") return selectedRuleset?.name ?? "";
        return "Generate Ruleset";
    }

    if (!isOpen) return null;

    return (
        <>
            <div className="drawer-overlay" onClick={handleClose} />
            <div className="drawer" role="dialog" aria-label="Rulesets">

                <div className="drawer-header">
                    <div className="drawer-header-left">
                        {view !== "list" && (
                            <button
                                className="btn btnSmall"
                                onClick={handleBack}
                                aria-label="Back to rulesets"
                            >
                                <ChevronLeft size={14} />
                            </button>
                        )}
                        <div className="drawer-title">{drawerTitle()}</div>
                    </div>
                    <button
                        className="drawer-close btn btnSmall"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        <X size={12} strokeWidth={4} />
                    </button>
                </div>

                <div className="drawer-body">
                    {isLoading && (
                        <div className="state-message">Loading...</div>
                    )}

                    {!isLoading && error && (
                        <div className="state-message error" role="alert">
                            {error}
                        </div>
                    )}

                    {/* LIST VIEW */}
                    {!isLoading && !error && view === "list" && (
                        <div className="ruleset-list">
                            <button
                                className="compose-trigger-btn btn"
                                onClick={() => setView("compose")}
                            >
                                <Sparkles size={14} />
                                Generate with AI
                            </button>

                            {rulesets.length === 0 && (
                                <div className="state-message">
                                    No rulesets found. Run the seed command first.
                                </div>
                            )}
                            {rulesets.map((ruleset) => (
                                <div
                                    key={ruleset.id}
                                    className="ruleset-card"
                                    onClick={() => handleSelectRuleset(ruleset.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === "Enter" && handleSelectRuleset(ruleset.id)}
                                >
                                    <div className="ruleset-card-top">
                                        <div className="ruleset-card-name">{ruleset.name}</div>
                                        <span className={`source-badge source-${ruleset.source}`}>
                                            {ruleset.source}
                                        </span>
                                    </div>
                                    {ruleset.description && (
                                        <div className="ruleset-card-desc">{ruleset.description}</div>
                                    )}
                                    <div className="ruleset-card-meta">
                                        {ruleset.version && <span>v{ruleset.version}</span>}
                                        <span>{ruleset.rule_count} rules</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* DETAIL VIEW */}
                    {!isLoading && !error && view === "detail" && selectedRuleset && (
                        <div className="ruleset-detail">
                            {selectedRuleset.description && (
                                <div className="ruleset-detail-desc">
                                    {selectedRuleset.description}
                                </div>
                            )}
                            <div className="ruleset-detail-meta">
                                {selectedRuleset.version && (
                                    <span className="pill">v{selectedRuleset.version}</span>
                                )}
                                <span className="pill">
                                    {selectedRuleset.rules?.length ?? 0} rules
                                </span>
                                <span className={`source-badge source-${selectedRuleset.source}`}>
                                    {selectedRuleset.source}
                                </span>
                            </div>

                            <div className="rule-list">
                                {selectedRuleset.rules?.map((rule) => (
                                    <div key={rule.id} className="rule-card">
                                        <div className="rule-card-top">
                                            <span className={severityClass(rule.severity)}>
                                                {rule.severity}
                                            </span>
                                            {rule.ifc_class && (
                                                <span className="pill">{rule.ifc_class}</span>
                                            )}
                                            <span className="rule-id">{rule.rule_id}</span>
                                        </div>
                                        {rule.meta_title && (
                                            <div className="rule-title">{rule.meta_title}</div>
                                        )}
                                        {rule.meta_why && (
                                            <div className="rule-why">{rule.meta_why}</div>
                                        )}
                                        {rule.meta_how_to_fix && (
                                            <div className="rule-fix">
                                                <span className="rule-fix-label">How to fix: </span>
                                                {rule.meta_how_to_fix}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* COMPOSE VIEW */}
                    {view === "compose" && (
                        <div className="compose-form">
                            <div className="drawer-field">
                                <div className="drawer-field-label">Ruleset Name</div>
                                <div className="drawer-field-sub">A short name for this ruleset</div>
                                <input
                                    className="compose-input"
                                    type="text"
                                    placeholder="e.g. Hospital MEP Handover"
                                    value={composeName}
                                    disabled={composeStatus === "loading"}
                                    onChange={(e) => setComposeName(e.target.value)}
                                />
                            </div>

                            <div className="drawer-field">
                                <div className="drawer-field-label">Description</div>
                                <div className="drawer-field-sub">
                                    Describe what you want validated in plain language
                                </div>
                                <textarea
                                    className="compose-textarea"
                                    placeholder="e.g. Check that all spaces have a room number, all walls have a fire rating, and no elements have duplicate GlobalIds."
                                    value={composeDescription}
                                    disabled={composeStatus === "loading"}
                                    rows={6}
                                    onChange={(e) => setComposeDescription(e.target.value)}
                                />
                            </div>

                            {composeStatus === "error" && composeError && (
                                <div className="state-message error" role="alert">
                                    {composeError}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer — only shown in compose view */}
                {view === "compose" && (
                    <div className="drawer-footer">
                        <button
                            className="drawer-run-btn"
                            onClick={handleCompose}
                            disabled={
                                !composeName.trim() ||
                                !composeDescription.trim() ||
                                composeStatus === "loading"
                            }
                        >
                            {composeStatus === "loading" ? "Generating..." : "Generate Ruleset"}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

export default RulesetDrawer;