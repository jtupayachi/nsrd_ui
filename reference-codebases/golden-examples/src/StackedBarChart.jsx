/**
 * GOLDEN EXAMPLE — Recharts stacked bar chart with grouping + area chart
 * Demonstrates: BarChart with stacked Bars, AreaChart, multiple series,
 *               custom legend, computed totals, CSV parsing
 * Styling: Tailwind CSS
 *
 * KEY RULES for stacked bars:
 *   1. Add stackId="a" to each <Bar> that should stack together
 *   2. All Bars with the same stackId stack on top of each other
 *   3. Different stackId values = side-by-side groups
 *   4. <Legend /> automatically shows each stacked series name
 */
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

const CSV_DATA = `month,solar,wind,hydro,thermal
Jan,120,85,40,210
Feb,140,90,38,195
Mar,180,75,42,175
Apr,220,70,45,155
May,260,65,48,140
Jun,290,60,50,130
Jul,280,58,49,125
Aug,265,62,47,135
Sep,230,68,44,150
Oct,185,78,41,170
Nov,145,88,39,190
Dec,115,92,37,215`;

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

const COLORS = {
  solar:   '#f59e0b',
  wind:    '#3b82f6',
  hydro:   '#14b8a6',
  thermal: '#6b7280',
};

export default function StackedBarChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(parseCSV(CSV_DATA));
  }, []);

  const totalBySource = data.length
    ? {
        solar:   data.reduce((s, d) => s + d.solar, 0),
        wind:    data.reduce((s, d) => s + d.wind, 0),
        hydro:   data.reduce((s, d) => s + d.hydro, 0),
        thermal: data.reduce((s, d) => s + d.thermal, 0),
      }
    : {};

  const grandTotal = Object.values(totalBySource).reduce((s, v) => s + v, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Energy Production Mix</h1>
        <p className="text-gray-500 text-sm mt-0.5">Monthly generation by source (GWh) — 2024</p>
      </div>

      {/* Share summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Object.entries(COLORS).map(([source, color]) => {
          const pct = grandTotal ? ((totalBySource[source] / grandTotal) * 100).toFixed(1) : '0';
          return (
            <div key={source} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ background: color }} />
              <div>
                <p className="text-xs text-gray-500 capitalize">{source}</p>
                <p className="text-lg font-bold text-gray-800">{pct}%</p>
                <p className="text-xs text-gray-400">{totalBySource[source]} GWh</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stacked bar chart — stackId="a" groups all bars */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Monthly Generation by Source (Stacked)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {/* stackId="a" makes all four bars stack into one column per month */}
            <Bar dataKey="solar"   name="Solar"   stackId="a" fill={COLORS.solar}   />
            <Bar dataKey="wind"    name="Wind"    stackId="a" fill={COLORS.wind}    />
            <Bar dataKey="hydro"   name="Hydro"   stackId="a" fill={COLORS.hydro}   />
            <Bar dataKey="thermal" name="Thermal" stackId="a" fill={COLORS.thermal} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Area chart for trend */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Generation Trend (Stacked Area)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {/* stackId="1" stacks area series */}
            <Area type="monotone" dataKey="solar"   name="Solar"   stackId="1" stroke={COLORS.solar}   fill={COLORS.solar}   fillOpacity={0.5} />
            <Area type="monotone" dataKey="wind"    name="Wind"    stackId="1" stroke={COLORS.wind}    fill={COLORS.wind}    fillOpacity={0.5} />
            <Area type="monotone" dataKey="hydro"   name="Hydro"   stackId="1" stroke={COLORS.hydro}   fill={COLORS.hydro}   fillOpacity={0.5} />
            <Area type="monotone" dataKey="thermal" name="Thermal" stackId="1" stroke={COLORS.thermal} fill={COLORS.thermal} fillOpacity={0.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
