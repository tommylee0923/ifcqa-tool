interface FilterBarProps {
    severityFilter: string;
    onSeverityChange: (value: string) => void;
    ifcClassFilter: string;
    onIfcClassChange: (value: string) => void;
    ifcClasses: string[];
}

interface ChipGroupProps {
    label?: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}

function ChipGroup({ label, value, options, onChange }: ChipGroupProps) {
    return (
        <div className="chips">
            {label ? <span className="chip-label">{label}</span> : null}

            {options.map((option) => {
                const isActive = value === option.value;

                return (
                    <button
                        key={option.value || "all"}
                        type="button"
                        className={isActive ? "chip active" : "chip"}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    )
}

function FilterBar({
    severityFilter,
    onSeverityChange,
    ifcClassFilter,
    onIfcClassChange,
    ifcClasses,
}: FilterBarProps) {

    const severityOptions = [
        { value: "All", label: "All" },
        { value: "Error", label: "Error" },
        { value: "Warning", label: "Warning" },
        { value: "Info", label: "Info" },
    ];

    const classOptions = [
        { value: "All", label: "All" },
        ...ifcClasses.map((cls) => ({ value: cls, label: cls })),
    ];

    return (
        <>
            {/* Legacy: only show source row when more than one engine */}

            <ChipGroup
                value={ifcClassFilter}
                options={classOptions}
                onChange={onIfcClassChange}
            />

            <ChipGroup
                label="Severity"
                value={severityFilter}
                options={severityOptions}
                onChange={onSeverityChange}
            />
        </>
    );
}

export default FilterBar;