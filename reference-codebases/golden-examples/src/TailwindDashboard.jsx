/**
 * TailwindDashboard.jsx — Golden Example
 *
 * Demonstrates Tailwind CSS with Recharts:
 *  • KPI summary cards (Tailwind grid)
 *  • BarChart + LineChart in Tailwind card containers
 *  • Tab switcher using Tailwind classes
 *  • Responsive layout with Tailwind grid/flex
 *  • ALL styling via className — NO inline style={{}} except Recharts containers
 *
 * Note: ResponsiveContainer requires explicit height in its style or height prop.
 *       That is the ONLY place a numeric/px height is acceptable.
 */

import React, { useState } from 'react';
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

const MONTHLY_DATA = [
  { month: 'Jan', precipitation: 4.2, temperature: 38, dissolved_oxygen: 10.2 },
  { month: 'Feb', precipitation: 3.8, temperature: 42, dissolved_oxygen: 10.5 },
  { month: 'Mar', precipitation: 5.1, temperature: 52, dissolved_oxygen: 9.8 },
  { month: 'Apr', precipitation: 4.7, temperature: 62, dissolved_oxygen: 9.1 },
  { month: 'May', precipitation: 4.3, temperature: 71, dissolved_oxygen: 8.4 },
  { month: 'Jun', precipitation: 3.6, temperature: 79, dissolved_oxygen: 7.8 },
  { month: 'Jul', precipitation: 3.9, temperature: 83, dissolved_oxygen: 7.2 },
  { month: 'Aug', precipitation: 3.2, temperature: 82, dissolved_oxygen: 7.5 },
  { month: 'Sep', precipitation: 3.4, temperature: 74, dissolved_oxygen: 8.0 },
  { month: 'Oct', precipitation: 3.8, temperature: 63, dissolved_oxygen: 9.2 },
  { month: 'Nov', precipitation: 4.5, temperature: 51, dissolved_oxygen: 9.9 },
  { month: 'Dec', precipitation: 4.1, temperature: 41, dissolved_oxygen: 10.4 },
];

const KPI_CARDS = [
  { label: 'Avg Temperature', value: '61.5', unit: '°F', trend: '+1.2°', up: true, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
  { label: 'Avg Precipitation', value: '4.1', unit: ' in', trend: '-0.3 in', up: false, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
  { label: 'Avg DO Level', value: '9.0', unit: ' mg/L', trend: '+0.2', up: true, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  { label: 'Sample Points', value: '247', unit: '', trend: '12 new', up: true, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
];

const TABS = ['Precipitation', 'Temperature', 'Dissolved Oxygen'];

function KpiCard({ label, value, unit, trend, up, color, bg }) {
  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{label}</div>
      <div className={`text-3xl font-extrabold ${color}`}>
        {value}<span className="text-base font-medium text-gray-400 ml-1">{unit}</span>
      </div>
      <div className={`mt-2 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
        {up ? '▲' : '▼'} {trend} vs last year
      </div>
    </div>
  );
}

export default function TailwindDashboard() {
  const [activeTab, setActiveTab] = useState('Precipitation');

  const dataKey = activeTab === 'Precipitation' ? 'precipitation'
    : activeTab === 'Temperature' ? 'temperature'
    : 'dissolved_oxygen';

  const chartColor = activeTab === 'Precipitation' ? '#2563eb'
    : activeTab === 'Temperature' ? '#f97316'
    : '#10b981';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Environmental Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Monthly monitoring data · Oak Ridge Reservation · 2024</p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_CARDS.map(k => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>

        {/* Annual Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Monthly Precipitation</h2>
          <p className="text-xs text-gray-500 mb-4">Inches of precipitation per month</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={MONTHLY_DATA} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="precipitation" name="Precipitation (in)" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabbed Line Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-900">Annual Trend</h2>
            <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={MONTHLY_DATA} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey={dataKey}
                name={activeTab}
                stroke={chartColor}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
