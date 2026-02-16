import React from 'react';

const BetterHeatMap = ({ data, xLabels, width = 600, height = 150 }) => {
  if (!Array.isArray(data) || !Array.isArray(xLabels) || data.length !== xLabels.length || data.length === 0) {
    return null;
  }

  const cells = xLabels
    .map((label, index) => {
      if (label == null || String(label).trim() === '') return null;
      const numericValue = Number(data[index]);
      if (Number.isNaN(numericValue)) return null;
      return {
        label: String(label),
        value: Math.max(0, numericValue)
      };
    })
    .filter(Boolean);

  if (cells.length === 0) {
    return null;
  }

  const maxVal = Math.max(1, ...cells.map(cell => cell.value));
  const minColumnWidth = 56;
  const gridWidth = Math.max(width, cells.length * minColumnWidth);
  const barMaxHeight = Math.max(42, height - 56);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          minWidth: `${gridWidth}px`,
          display: 'grid',
          gridTemplateColumns: `repeat(${cells.length}, minmax(${minColumnWidth}px, 1fr))`,
          gap: '0.45rem',
          alignItems: 'end'
        }}
      >
        {cells.map((cell, index) => {
          const ratio = maxVal > 0 ? cell.value / maxVal : 0;
          const barHeight = Math.max(8, Math.round(ratio * barMaxHeight));
          const alpha = 0.2 + (ratio * 0.75);

          return (
            <div key={`${cell.label}-${index}`} style={{ textAlign: 'center' }}>
              <div
                style={{
                  height: `${barHeight}px`,
                  borderRadius: 8,
                  background: `rgba(67, 162, 202, ${alpha.toFixed(3)})`,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  transition: 'height 220ms ease'
                }}
                title={`${cell.label}: ${cell.value}`}
              />
              <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#f5a623', fontWeight: 700 }}>
                {cell.value}
              </div>
              <div style={{ marginTop: '0.15rem', fontSize: '0.72rem', color: '#a0a0a0' }}>
                {cell.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BetterHeatMap;
