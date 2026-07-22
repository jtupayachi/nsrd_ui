/**
 * GOLDEN EXAMPLE — Species richness page: horizontal bar chart + data cards
 * Demonstrates: horizontal BarChart layout, cell fill by value, summary cards
 * Styling: Tailwind CSS — COLORS array kept for chart fill values (Recharts)
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, LabelList
} from 'recharts';

const CSV_DATA = `habitat,birds,mammals,reptiles,amphibians,fish,invertebrates
Deciduous Forest,142,38,24,18,0,312
Wetland,98,22,31,42,67,518
Grassland,87,31,19,8,0,241
Riparian Buffer,119,29,27,36,89,447
Pine Plantation,54,18,11,5,0,128
Rocky Outcrops,61,24,28,12,0,183
Open Water,73,12,4,21,112,294`;

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

const GROUPS = ['birds', 'mammals', 'reptiles', 'amphibians', 'fish', 'invertebrates'];
const COLORS = ['#007aff', '#34c759', '#ff9f0a', '#5ac8fa', '#af52de', '#ff3b30'];

const GROUP_BTN = {
  birds:        { active: 'bg-blue-500 text-white',   inactive: 'bg-gray-100 text-gray-900' },
  mammals:      { active: 'bg-green-500 text-white',  inactive: 'bg-gray-100 text-gray-900' },
  reptiles:     { active: 'bg-orange-400 text-white', inactive: 'bg-gray-100 text-gray-900' },
  amphibians:   { active: 'bg-sky-400 text-white',    inactive: 'bg-gray-100 text-gray-900' },
  fish:         { active: 'bg-purple-500 text-white', inactive: 'bg-gray-100 text-gray-900' },
  invertebrates:{ active: 'bg-red-500 text-white',    inactive: 'bg-gray-100 text-gray-900' },
};

export default function SpeciesRichness() {
  const [data, setData] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('birds');

  useEffect(() => {
    setData(parseCSV(CSV_DATA));
  }, []);

  const chartData = useMemo(() => {
    return data
      .map(d => ({ habitat: d.habitat, value: d[selectedGroup], total: GROUPS.reduce((s, g) => s + d[g], 0) }))
      .sort((a, b) => b.value - a.value);
  }, [data, selectedGroup]);

  const maxVal = Math.max(...chartData.map(d => d.value));
  const groupColor = COLORS[GROUPS.indexOf(selectedGroup)];

  const totals = useMemo(() => {
    if (!data.length) return {};
    return GROUPS.reduce((acc, g) => {
      acc[g] = data.reduce((s, d) => s + d[g], 0);
      return acc;
    }, {});
  }, [data]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Species Richness by Habitat</h2>

      {/* Taxon selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {GROUPS.map((g, i) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={`px-4 py-1.5 rounded-full border-0 cursor-pointer text-sm font-medium capitalize transition-colors ${
              selectedGroup === g ? GROUP_BTN[g].active : GROUP_BTN[g].inactive
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Horizontal bar chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 0, right: 60, left: 120, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, maxVal + 10]} />
          <YAxis type="category" dataKey="habitat" tick={{ fontSize: 12 }} width={115} />
          <Tooltip formatter={v => [`${v} species`, selectedGroup]} />
          <Bar dataKey="value" name={selectedGroup} radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={groupColor} fillOpacity={0.5 + 0.5 * (entry.value / maxVal)} />
            ))}
            <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#1d1d1f' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-3 mt-6">
        {GROUPS.map((g, i) => (
          <div
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={`px-4 py-3 rounded-xl border cursor-pointer min-w-[110px] transition-colors ${
              selectedGroup === g ? 'border-current' : 'bg-gray-100 border-gray-200'
            }`}
            style={selectedGroup === g ? { background: COLORS[i] + '15', borderColor: COLORS[i] } : {}}
          >
            <p className="text-xs text-gray-500 capitalize mb-1">{g}</p>
            <p className="text-xl font-bold" style={{ color: COLORS[i] }}>{totals[g]}</p>
            <p className="text-xs text-gray-500">total species</p>
          </div>
        ))}
      </div>
    </div>
  );
}
