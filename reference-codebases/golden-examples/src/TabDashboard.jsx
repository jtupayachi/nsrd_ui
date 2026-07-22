/**
 * GOLDEN EXAMPLE — Tab-based dashboard with multiple chart views
 * Demonstrates: useState for active tab, conditional rendering, multiple chart types,
 *               tab navigation bar, badge counts, Tailwind active/inactive styles
 * Styling: Tailwind CSS
 *
 * USE THIS PATTERN when a page has multiple data views the user can switch between.
 * Each tab renders its own content — no routing needed.
 */
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

const CSV_DATA = `date,temp_c,wind_ms,humidity,rain_mm
2024-01-01,2.1,3.2,85,0.0
2024-01-02,3.5,4.1,78,1.2
2024-01-03,1.8,2.8,90,3.5
2024-01-04,5.2,5.6,72,0.0
2024-01-05,6.1,6.3,68,0.0
2024-01-06,4.3,4.8,75,0.8
2024-01-07,7.8,7.1,63,0.0
2024-01-08,9.2,5.9,60,0.0
2024-01-09,8.5,6.7,65,0.0
2024-01-10,6.0,5.2,71,2.1`;

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

const TABS = [
  { id: 'temperature', label: 'Temperature' },
  { id: 'wind',        label: 'Wind Speed'  },
  { id: 'rain',        label: 'Rainfall'    },
];

export default function TabDashboard() {
  const [data, setData]         = useState([]);
  const [activeTab, setActiveTab] = useState('temperature');

  useEffect(() => {
    setData(parseCSV(CSV_DATA));
  }, []);

  const totalRain  = data.reduce((s, d) => s + d.rain_mm, 0).toFixed(1);
  const avgTemp    = data.length ? (data.reduce((s, d) => s + d.temp_c, 0) / data.length).toFixed(1) : '-';
  const maxWind    = data.length ? Math.max(...data.map(d => d.wind_ms)).toFixed(1) : '-';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Weather Station Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Jan 2024 · {data.length} daily records</p>
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-orange-400">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Temp</p>
          <p className="text-2xl font-bold text-gray-800">{avgTemp} <span className="text-sm font-normal text-gray-400">°C</span></p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Max Wind</p>
          <p className="text-2xl font-bold text-gray-800">{maxWind} <span className="text-sm font-normal text-gray-400">m/s</span></p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-teal-400">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Rain</p>
          <p className="text-2xl font-bold text-gray-800">{totalRain} <span className="text-sm font-normal text-gray-400">mm</span></p>
        </div>
      </div>

      {/* Tab navigation bar */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content — conditional render based on activeTab */}
        <div className="p-6">
          {activeTab === 'temperature' && (
            <div>
              <h2 className="font-semibold text-gray-800 mb-4">Daily Temperature</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="temp_c" stroke="#f97316" dot={false} strokeWidth={2} name="Temp (°C)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'wind' && (
            <div>
              <h2 className="font-semibold text-gray-800 mb-4">Wind Speed</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="wind_ms" stroke="#3b82f6" dot={false} strokeWidth={2} name="Wind (m/s)" />
                  <Line type="monotone" dataKey="humidity" stroke="#8b5cf6" dot={false} strokeWidth={2} name="Humidity (%)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'rain' && (
            <div>
              <h2 className="font-semibold text-gray-800 mb-4">Daily Rainfall</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rain_mm" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Rain (mm)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
