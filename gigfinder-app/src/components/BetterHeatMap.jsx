// src/components/BetterHeatMap.jsx
import React from 'react';
import { XYPlot, XAxis, YAxis, HeatmapSeries, LabelSeries } from 'react-vis';
import 'react-vis/dist/style.css';

const BetterHeatMap = ({ data, xLabels, width = 600, height = 150 }) => {
  // Ensure data and xLabels are defined and have the same length
  if (!data || !xLabels || data.length !== xLabels.length) {
    return <div>Invalid heat map data.</div>;
  }
  
  // Convert one-row data into an array of objects for the heatmap:
  const cells = xLabels.map((label, index) => ({
    x: label,
    y: 0, // single row
    value: data[index],
  }));
  
  // Determine the maximum value for color scaling
  const maxVal = Math.max(...data);

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
        colorRange={['#e0f3db', '#43a2ca']} // You can adjust the color range as needed
        style={{ stroke: '#fff', strokeWidth: '2px' }}
      />
      <LabelSeries
        data={cells.map(cell => ({ ...cell, label: cell.value.toString() }))}
        labelAnchorX="middle"
        labelAnchorY="baseline"
        style={{ fontSize: '14px', fill: '#000' }}
      />
    </XYPlot>
  );
};

export default BetterHeatMap;
