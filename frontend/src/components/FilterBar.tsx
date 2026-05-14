interface FilterBarProps {
    severityFilter: string;
    onSeverityChange: (value: string) => void;
    ifcClassFilter: string;
    onIfcClassChange: (value: string) => void;
    ifcClasses: string[];
}

function FilterBar({
    severityFilter,
    onSeverityChange,
    ifcClassFilter,
    onIfcClassChange,
    ifcClasses,
}: FilterBarProps) {
    return (
        <section className="filter-bar">
            <label>
                Severity:
                <select value={severityFilter}
                    onChange={(event) => onSeverityChange(event.target.value)}>
                    <option value="All">All</option>
                    <option value="Error">Error</option>
                    <option value="Warning">Warning</option>
                    <option value="Info">Info</option>
                </select>
            </label>
            <label>
                IFC Class:
                <select
                    value={ifcClassFilter}
                    onChange={(event) => onIfcClassChange(event.target.value)}>
                    <option value="All">All</option>
                    {ifcClasses.map((ifcClass) => (
                        <option key={ifcClass} value={ifcClass}>
                            {ifcClass}
                        </option>
                    ))}
                </select>
            </label>
        </section>
    );
}

export default FilterBar;