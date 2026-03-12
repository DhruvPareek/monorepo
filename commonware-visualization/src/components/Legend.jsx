export default function Legend({ modules, activeModule, onSelect }) {
  const activeMod = modules.find((m) => m.name === activeModule);

  return (
    <div className="legend" onClick={(e) => e.stopPropagation()}>
      <div className="legend-header" aria-hidden="true">
        <span className="legend-header-label">commonware modules</span>
      </div>
      <div className="legend-items">
        {modules.map((mod) => {
          const isActive = activeModule === mod.name;
          return (
            <div
              key={mod.name}
              className={`legend-item ${isActive ? 'legend-item--active' : ''}`}
              onClick={() => onSelect(isActive ? null : mod.name)}
            >
              <span
                className="legend-swatch"
                style={{ backgroundColor: mod.color }}
              />
              <span className="legend-label">{mod.name}</span>
            </div>
          );
        })}
      </div>
      {activeMod && (
        <div className="legend-detail">
          <span className="legend-detail-title">{activeMod.short}</span>
          {' -- '}
          <span className="legend-detail-body">{activeMod.detail}</span>
        </div>
      )}
    </div>
  );
}
