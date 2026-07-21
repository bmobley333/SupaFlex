// src/components/codex/CodexView.tsx
import React from 'react';
import { CodexSearch } from './CodexSearch';
import { BuildCustomizer } from './BuildCustomizer';

export const CodexView: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-[2500px] mx-auto">
      {/* Left Column (2/3): Searchable Codex Reference */}
      <div className="lg:col-span-2">
        <CodexSearch />
      </div>

      {/* Right Column (1/3): Build Customizer & Content Creator */}
      <div>
        <BuildCustomizer />
      </div>
    </div>
  );
};
