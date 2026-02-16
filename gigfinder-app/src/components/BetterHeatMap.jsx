// src/components/BetterHeatMap.jsx
import React from 'react';
import { XYPlot, XAxis, YAxis, HeatmapSeries, LabelSeries } from 'react-vis';
import 'react-vis/dist/style.css';

const BetterHeatMap = ({ data, xLabels, width = 600, height = 150 }) => {
  // Ensure data and xLabels are defined and have the same length
  if (!data || !Array.isArray(data) || !xLabels || !Array.isArray(xLabels) || data.length !== xLabels.length || data.length === 0) {
    return null;
  }

  // Filter out invalid values and ensure all labels are strings
  const validLabels = xLabels.filter(label => label != null && String(label).trim() !== '');
  const validData = data.filter(d => d != null && !isNaN(d));

  if (validLabels.length === 0 || validData.length === 0 || validLabels.length !== validData.length) {
    return null;
  }

  // Convert one-row data into an array of objects for the heatmap
  const cells = validLabels.map((label, index) => ({
    x: String(label), // Ensure label is a string
    y: 0, // single row
    value: Math.max(0, Number(validData[index]) || 0), // Ensure positive number
  }));

  // Determine the maximum value for color scaling
  const maxVal = Math.max(1, ...validData.map(v => Math.max(0, Number(v) || 0)));

  return (
    <XYPlot
      xType="ordinal"
      width={width}
      height={height}
      margin={{ left: 50, right: 50, top: 10, bottom: 50 }}
    >
      <XAxis />
      <YAxis hideLine hideTicks />
      <HeatmapSeries
        className="heatmap-series-example"
        data={cells}
        colorRange={['#e0f3db', '#43a2ca']}
        style={{ stroke: '#fff', strokeWidth: '2px' }}
      />
      <LabelSeries
        data={cells.map(cell => ({ ...cell, label: String(cell.value) }))}
        labelAnchorX="middle"
        labelAnchorY="baseline"
        style={{ fontSize: '14px', fill: '#000' }}
      />
    </XYPlot>
  );
};

export default BetterHeatMap;
