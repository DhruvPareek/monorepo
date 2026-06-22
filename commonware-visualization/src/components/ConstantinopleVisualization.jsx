import { useState, useCallback } from 'react';
import ConstantinopleValidatorVisualization from './ConstantinopleValidatorVisualization';
// The full chain visualization is built and preserved in
// ./ConstantinopleChainVisualization. It is hidden behind a "coming soon"
// placeholder for now; to re-enable, render <ConstantinopleChainVisualization
// mousePos={mousePos} /> from the 'chain' sub-tab below.

const SUB_TABS = [
  { id: 'chain', label: 'chain' },
  { id: 'validator', label: 'validator' },
];

const DEFAULT_SUB_TAB = 'validator';

function ChainComingSoon() {
  return (
    <div className="const-comingsoon">coming soon...</div>
  );
}

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

      {subTab === 'chain' && <ChainComingSoon />}
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
