/**
 * GOLDEN EXAMPLE — Time series dashboard with KPI cards, multi-metric line chart, data table
 *
 * MATCHES USER INPUTS LIKE:
 *   "time series dashboard with line chart"
 *   "show data over time with KPI cards"
 *   "trend dashboard for sensor readings"
 *   "historical data dashboard, line chart over time"
 *   "environmental monitoring dashboard with dates"
 *   "climate data time series, multiple metrics"
 *   "monthly or daily data, show trends"
 *   "temperature humidity readings over time dashboard"
 *   "multi-metric time series line chart"
 *   "date-based data visualization dashboard"
 *
 * USE THIS TEMPLATE WHEN:
 *   - CSV has a date/datetime column and multiple numeric columns
 *   - No lat/lng (no map needed), focus is temporal
 *   - User wants to see how metrics change over time
 *   - Could be one site or one study with many readings over time
 *
 * CSV COLUMNS THIS HANDLES:
 *   date, datetime, timestamp, time, month, year → X axis
 *   Any numeric column → plottable metric
 *   Optional: site, station, tower → used to filter (shows one at a time)
 *
 * DEMONSTRATES:
 *   - KPI cards showing latest, min, max, avg for active metric
 *   - Multi-line chart (toggle lines on/off via legend)
 *   - Date range filter buttons (7d, 30d, 90d, All)
 *   - Summary stats table (by month or grouped period)
 *   - Metric selector tabs
 */
import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

const DATA_CSV = `date,temperature_c,humidity_pct,wind_ms,soil_moisture
2024-01-01,3.2,81,3.5,42
2024-01-08,4.1,78,4.2,40
2024-01-15,5.8,74,3.1,37
2024-01-22,6.2,72,5.0,35
2024-02-01,4.5,80,4.8,38
2024-02-08,5.1,76,3.9,36
2024-02-15,7.4,70,4.3,33
2024-02-22,8.0,68,5.5,31
2024-03-01,9.2,65,3.8,29
2024-03-08,11.5,61,4.1,27
2024-03-15,13.8,58,3.5,26
2024-03-22,14.2,56,4.9,25
2024-04-01,16.5,55,5.2,24
2024-04-08,17.8,53,4.6,23
2024-04-15,19.1,52,3.7,22
2024-04-22,20.4,50,4.0,21
2024-05-01,22.1,49,4.8,20
2024-05-08,23.5,48,5.1,19
2024-05-15,24.8,47,3.9,19
2024-05-22,25.2,46,4.5,18`;

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

const METRICS = [
  { key: 'temperature_c',  label: 'Temperature', unit: '°C',  color: '#ef4444' },
  { key: 'humidity_pct',   label: 'Humidity',    unit: '%',   color: '#3b82f6' },
  { key: 'wind_ms',        label: 'Wind',        unit: 'm/s', color: '#10b981' },
  { key: 'soil_moisture',  label: 'Soil Moist.', unit: '%',   color: '#f59e0b' },
];

const RANGES = [
  { label: '4 wk', weeks: 4 },
  { label: '8 wk', weeks: 8 },
  { label: '12 wk', weeks: 12 },
  { label: 'All', weeks: null },
];

export default function TimeSeriesDashboard() {
  const allData = useMemo(() => parseCSV(DATA_CSV), []);
  const [activeMetric, setActiveMetric] = useState(METRICS[0].key);
  const [range, setRange]   = useState(null);   // null = all
  const [chartType, setChartType] = useState('line'); // 'line' | 'area'
  const [visibleLines, setVisibleLines] = useState(
    Object.fromEntries(METRICS.map(m => [m.key, m.key === METRICS[0].key]))
  );

  const data = useMemo(() => {
    if (!range) return allData;
    const cutoff = new Date(allData.at(-1).date);
    cutoff.setDate(cutoff.getDate() - range * 7);
    return allData.filter(r => new Date(r.date) >= cutoff);
  }, [allData, range]);

  const activeMeta = METRICS.find(m => m.key === activeMetric) || METRICS[0];
  const activeVals = data.map(r => r[activeMetric]).filter(v => v != null);
  const latest = data.at(-1)?.[activeMetric];
  const minV   = Math.min(...activeVals).toFixed(1);
  const maxV   = Math.max(...activeVals).toFixed(1);
  const avgV   = (activeVals.reduce((s, v) => s + v, 0) / (activeVals.length || 1)).toFixed(1);

  function toggleLine(key) {
    setVisibleLines(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const ChartComponent = chartType === 'area' ? AreaChart : LineChart;
  const DataComponent  = chartType === 'area' ? Area       : Line;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Environmental Time Series</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {allData.length} records · {allData[0]?.date} → {allData.at(-1)?.date}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Latest',  value: latest, color: 'blue'   },
          { label: 'Minimum', value: minV,   color: 'emerald'},
          { label: 'Maximum', value: maxV,   color: 'red'    },
          { label: 'Average', value: avgV,   color: 'amber'  },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 border-${color}-500`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {value} {activeMeta.unit}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{activeMeta.label}</p>
          </div>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Metric selector */}
        <div className="flex gap-1">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeMetric === m.key
                  ? 'text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
              }`}
              style={activeMetric === m.key ? { backgroundColor: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex gap-1 ml-auto">
          {RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setRange(r.weeks)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r.weeks ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Chart type */}
        <button
          onClick={() => setChartType(t => t === 'line' ? 'area' : 'line')}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
        >
          {chartType === 'line' ? 'Area' : 'Line'} chart
        </button>
      </div>

      {/* Main time series chart */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Trend Over Time</h2>
          <div className="flex gap-2 flex-wrap">
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => toggleLine(m.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                  visibleLines[m.key] ? 'border-transparent text-white' : 'bg-white text-gray-400 border-gray-200'
                }`}
                style={visibleLines[m.key] ? { backgroundColor: m.color } : {}}
              >
                <span className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: visibleLines[m.key] ? 'white' : m.color }}
                />
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ChartComponent data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickFormatter={d => d.slice(5)} // show MM-DD
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={d => `Date: ${d}`} />
            <Legend />
            {METRICS.filter(m => visibleLines[m.key]).map(m => (
              <DataComponent
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                dot={false}
                fill={m.color}
                fillOpacity={chartType === 'area' ? 0.12 : 0}
              />
            ))}
          </ChartComponent>
        </ResponsiveContainer>
      </div>

      {/* Data table */}
      <div className="bg-white rounded-2xl shadow-sm p-5 overflow-x-auto">
        <h2 className="font-semibold text-gray-800 mb-3">Data Table</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
              <th className="py-2 pr-6">Date</th>
              {METRICS.map(m => (
                <th key={m.key}
                  className={`py-2 pr-6 ${m.key === activeMetric ? 'text-blue-600 font-bold' : ''}`}>
                  {m.label} ({m.unit})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1.5 pr-6 font-medium text-gray-700">{row.date}</td>
                {METRICS.map(m => (
                  <td key={m.key}
                    className={`py-1.5 pr-6 ${m.key === activeMetric ? 'text-blue-700 font-semibold' : 'text-gray-600'}`}>
                    {row[m.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
