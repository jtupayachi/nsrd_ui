/**
 * GOLDEN EXAMPLE — Multi-year time series dashboard for field monitoring data
 *
 * MATCHES USER INPUTS LIKE:
 *   "5 years of data from monitoring towers"
 *   "multi-year time series of environmental measurements"
 *   "annual trends from field instruments over several years"
 *   "long term data visualization tower measurements"
 *   "yearly or monthly monitoring data line chart"
 *   "time series dashboard with year filter"
 *   "historical data chart multiple measurement types"
 *   "temperature humidity wind data over time from towers"
 *   "line chart with date axis and multiple series"
 *
 * CSV COLUMNS THIS HANDLES:
 *   date, timestamp, month, year   → X axis (time dimension)
 *   tower, station, site           → filter / grouping dimension
 *   temp_c, temperature            → red line series
 *   humidity_pct, humidity         → blue line series
 *   wind_ms, wind_speed            → green line series
 *   any numeric column             → additional toggleable line
 *
 * SVG LAYOUT REGIONS THIS HANDLES:
 *   chart, line-chart, time-chart, graph  → main Recharts LineChart area
 *   filter, year-filter, controls         → year selector buttons row
 *   stats, stat-cards, kpi, summary       → min/avg/max stat cards
 *   toggles, series-toggle, legend        → series on/off buttons
 *   full-width, single-column             → stacked vertical layout
 *
 * DEMONSTRATES:
 *   - Multi-year CSV with date, tower, and multiple measurement columns
 *   - Year filter buttons to slice data
 *   - LineChart with multiple data series (one line per measurement type)
 *   - Summary stat cards (min, max, average) that update with filter
 *   - Tailwind layout, fully responsive
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// Inline multi-year CSV — replace with fetch() for real data
const TIMESERIES_CSV = `date,tower,temp_c,humidity_pct,wind_ms
2020-01,T01,3.2,82,3.1
2020-04,T01,14.5,65,4.8
2020-07,T01,27.8,58,3.9
2020-10,T01,11.2,72,5.2
2021-01,T01,1.8,85,2.7
2021-04,T01,15.1,63,5.1
2021-07,T01,28.4,55,4.2
2021-10,T01,12.0,70,4.9
2022-01,T01,4.5,80,3.4
2022-04,T01,16.2,60,5.6
2022-07,T01,29.1,53,4.5
2022-10,T01,13.5,68,5.8
2023-01,T01,2.9,83,3.0
2023-04,T01,14.8,66,4.7
2023-07,T01,28.0,57,3.8
2023-10,T01,11.8,71,5.0
2024-01,T01,3.7,81,3.3
2024-04,T01,15.6,62,5.3
2024-07,T01,29.5,54,4.6
2024-10,T01,12.9,69,5.5`;

function parseCSV(csv) {
  const [header, ...rows] = csv.trim().split('\n');
  const keys = header.split(',').map(k => k.trim());
  return rows.map(row => {
    const vals = row.split(',');
    return keys.reduce((obj, k, i) => {
      const v = vals[i]?.trim();
      obj[k] = isNaN(v) ? v : Number(v);
      return obj;
    }, {});
  });
}

const SERIES = [
  { key: 'temp_c',       label: 'Temp (°C)',    color: '#ef4444' },
  { key: 'humidity_pct', label: 'Humidity (%)', color: '#3b82f6' },
  { key: 'wind_ms',      label: 'Wind (m/s)',   color: '#10b981' },
];

const ALL_YEARS = 'All';

export default function MultiYearTimeSeries() {
  const [allData, setAllData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(ALL_YEARS);
  const [activeSeries, setActiveSeries] = useState(new Set(SERIES.map(s => s.key)));

  useEffect(() => { setAllData(parseCSV(TIMESERIES_CSV)); }, []);

  const years = useMemo(() => {
    const ys = [...new Set(allData.map(r => r.date.slice(0, 4)))].sort();
    return [ALL_YEARS, ...ys];
  }, [allData]);

  const filtered = useMemo(() =>
    selectedYear === ALL_YEARS
      ? allData
      : allData.filter(r => r.date.startsWith(selectedYear)),
    [allData, selectedYear]
  );

  const stats = useMemo(() =>
    SERIES.map(s => {
      const vals = filtered.map(r => r[s.key]).filter(v => v != null);
      if (!vals.length) return { ...s, min: '-', max: '-', avg: '-' };
      return {
        ...s,
        min: Math.min(...vals).toFixed(1),
        max: Math.max(...vals).toFixed(1),
        avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
      };
    }),
    [filtered]
  );

  const toggleSeries = (key) =>
    setActiveSeries(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Multi-Year Monitoring Data</h1>
          <p className="text-gray-500 text-sm mt-0.5">Field instrument time series · {filtered.length} records</p>
        </div>
        {/* Year filter */}
        <div className="flex gap-2 flex-wrap">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedYear === y
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.key} className="bg-white rounded-xl shadow-sm p-5 border-l-4" style={{ borderColor: s.color }}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
            <div className="flex justify-between text-sm text-gray-700">
              <span>Min: <strong>{s.min}</strong></span>
              <span>Avg: <strong>{s.avg}</strong></span>
              <span>Max: <strong>{s.max}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Series toggles */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {SERIES.map(s => (
          <button
            key={s.key}
            onClick={() => toggleSeries(s.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              activeSeries.has(s.key)
                ? 'border-transparent text-white'
                : 'bg-white text-gray-400 border-gray-200'
            }`}
            style={activeSeries.has(s.key) ? { background: s.color } : {}}
          >
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Line chart */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={filtered} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {SERIES.filter(s => activeSeries.has(s.key)).map(s => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
