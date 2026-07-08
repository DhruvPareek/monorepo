import { useState, useCallback } from 'react';
import ConstantinopleChainVisualization from './ConstantinopleChainVisualization';
import ConstantinopleValidatorVisualization from './ConstantinopleValidatorVisualization';

const SUB_TABS = [
  // Chain sub-tab temporarily hidden; uncomment to restore it (and consider
  // switching DEFAULT_SUB_TAB back to 'chain').
  // { id: 'chain', label: 'chain' },
  { id: 'validator', label: 'validator' },
];

const DEFAULT_SUB_TAB = 'validator';

export default function ConstantinopleVisualization() {
  const [subTab, setSubTab] = useState(DEFAULT_SUB_TAB);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div className="viz-container" onMouseMove={handleMouseMove}>
      <div className="viz-header">
        <h1 className="viz-title">
          <a
            href="https://github.com/commonwarexyz/constantinople"
            target="_blank"
            rel="noopener noreferrer"
          >
            Constantinople
          </a>
        </h1>
        <p className="viz-subtitle">
          Constantinople is a high-throughput account-model blockchain example built on top of commonware primitives.
        </p>
      </div>

      <div className="const-subtabs">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`const-subtab ${subTab === tab.id ? 'const-subtab--active' : ''}`}
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'chain' && (
        <ConstantinopleChainVisualization mousePos={mousePos} />
      )}
      {subTab === 'validator' && (
        <ConstantinopleValidatorVisualization mousePos={mousePos} />
      )}

      <div className="viz-footer">
        <a href="https://github.com/DhruvPareek/monorepo/tree/feat/visualization-work/commonware-visualization">GitHub</a>
        <a href="https://commonware.xyz">commonware.xyz</a>
      </div>
    </div>
  );
}
