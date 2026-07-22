/**
 * GOLDEN EXAMPLE — Recharts ScatterChart with two variables + color grouping
 * Demonstrates: ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Legend,
 *               multiple data groups, custom tooltip, CSV parsing
 * Styling: Tailwind CSS
 *
 * KEY RULES for ScatterChart:
 *   1. data goes on <Scatter data={array}> NOT on <ScatterChart data={array}>
 *   2. XAxis dataKey, YAxis dataKey are set on the axes, NOT on Scatter
 *   3. Each distinct group = one <Scatter> element with its own data + fill
 *   4. For dot size, use <ZAxis dataKey="size" range={[40, 200]} /> on the chart
 */
import React, { useState, useEffect } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const CSV_DATA = `site,height_m,value,group,count
A1,12.5,34.2,north,5
A2,18.0,52.1,north,8
A3,9.3,28.7,north,3
A4,22.1,67.4,north,11
A5,15.7,45.9,north,6
B1,10.2,71.3,south,4
B2,14.8,83.0,south,9
B3,8.5,60.5,south,2
B4,20.3,91.2,south,14
B5,17.6,75.8,south,7`;

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      const v = vals[i]?.trim();
      obj[h] = isNaN(v) ? v : Number(v);
      return obj;
    }, {});
  });
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-sm">
        <p className="font-semibold text-gray-800">{d.site}</p>
        <p className="text-gray-600">Height: {d.height_m} m</p>
        <p className="text-gray-600">Value: {d.value}</p>
        <p className="text-gray-600">Group: {d.group}</p>
      </div>
    );
  }
  return null;
};

export default function ScatterPlot() {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(parseCSV(CSV_DATA));
  }, []);

  // Split data into groups for separate Scatter elements
  const northData = data.filter(d => d.group === 'north');
  const southData = data.filter(d => d.group === 'south');

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Height vs. Measured Value</h2>
      <p className="text-gray-500 text-sm mb-6">Site monitoring data — grouped by region</p>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <ResponsiveContainer width="100%" height={380}>
          {/*
            CRITICAL: ScatterChart does NOT take a data prop.
            Each group's data goes on its own <Scatter data={...}> element.
          */}
          <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="height_m"
              name="Height (m)"
              type="number"
              domain={['auto', 'auto']}
              label={{ value: 'Tower Height (m)', position: 'insideBottom', offset: -10, fontSize: 12 }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              dataKey="value"
              name="Value"
              type="number"
              domain={['auto', 'auto']}
              label={{ value: 'Measurement', angle: -90, position: 'insideLeft', fontSize: 12 }}
              tick={{ fontSize: 12 }}
            />
            {/* ZAxis controls dot size — dataKey points to a numeric column */}
            <ZAxis dataKey="count" range={[40, 160]} name="Count" />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Legend verticalAlign="top" />
            {/* Each group is a separate <Scatter> with its own data array */}
            <Scatter name="North" data={northData} fill="#2563eb" opacity={0.8} />
            <Scatter name="South" data={southData} fill="#dc2626" opacity={0.8} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mt-6">
        <h3 className="font-semibold text-gray-800 mb-3">Data Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2 pr-4">Site</th>
                <th className="py-2 pr-4">Height (m)</th>
                <th className="py-2 pr-4">Value</th>
                <th className="py-2">Group</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.site} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 pr-4 font-medium text-gray-800">{row.site}</td>
                  <td className="py-1.5 pr-4 text-gray-600">{row.height_m}</td>
                  <td className="py-1.5 pr-4 text-gray-600">{row.value}</td>
                  <td className="py-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      row.group === 'north' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>{row.group}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
