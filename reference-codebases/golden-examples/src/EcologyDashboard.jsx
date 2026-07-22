/**
 * GOLDEN EXAMPLE — KPI stat cards + mixed recharts on a dashboard home
 * Demonstrates: stat cards, RadarChart, ScatterChart, useMemo aggregation
 * Styling: Tailwind CSS — borderLeft color kept as inline style (runtime value)
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ZAxis
} from 'recharts';

const CSV_DATA = `site,biomass,carbon,nitrogen,moisture,ph
A1,145.2,68.4,2.1,42.3,6.8
A2,132.7,61.2,1.9,38.7,7.1
B1,189.4,89.1,2.8,55.2,6.5
B2,201.3,94.7,3.1,58.9,6.3
C1,98.6,46.2,1.4,31.5,7.4
C2,112.4,52.8,1.6,35.8,7.2
D1,167.8,79.0,2.4,48.1,6.6
D2,178.2,83.9,2.6,51.4,6.7`;

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

function StatCard({ label, value, unit, color }) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl px-5 py-4"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">
        {value}<span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </p>
    </div>
  );
}

export default function EcologyDashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(parseCSV(CSV_DATA));
  }, []);

  const avg = useMemo(() => {
    if (!data.length) return {};
    const keys = ['biomass', 'carbon', 'nitrogen', 'moisture', 'ph'];
    return keys.reduce((acc, k) => {
      acc[k] = (data.reduce((s, d) => s + d[k], 0) / data.length).toFixed(1);
      return acc;
    }, {});
  }, [data]);

  const radarData = [
    { metric: 'Biomass', value: avg.biomass },
    { metric: 'Carbon', value: avg.carbon },
    { metric: 'Nitrogen', value: Number(avg.nitrogen) * 30 },
    { metric: 'Moisture', value: avg.moisture },
    { metric: 'pH', value: Number(avg.ph) * 10 },
  ];

  const scatterData = data.map(d => ({ x: d.moisture, y: d.biomass, z: d.carbon }));

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Ecology Site Dashboard</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Avg Biomass" value={avg.biomass} unit="g/m²" color="#34c759" />
        <StatCard label="Avg Carbon" value={avg.carbon} unit="g/m²" color="#007aff" />
        <StatCard label="Avg Nitrogen" value={avg.nitrogen} unit="g/m²" color="#ff9f0a" />
        <StatCard label="Avg Moisture" value={avg.moisture} unit="%" color="#5ac8fa" />
        <StatCard label="Avg pH" value={avg.ph} unit="" color="#af52de" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar */}
        <div>
          <h3 className="font-semibold mb-2">Site Profile (avg)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <Radar dataKey="value" stroke="#007aff" fill="#007aff" fillOpacity={0.3} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Scatter */}
        <div>
          <h3 className="font-semibold mb-2">Moisture vs Biomass</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Moisture %" />
              <YAxis dataKey="y" name="Biomass g/m²" />
              <ZAxis dataKey="z" range={[50, 200]} name="Carbon" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={scatterData} fill="#007aff" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
