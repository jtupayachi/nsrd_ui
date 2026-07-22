/**
 * GOLDEN EXAMPLE — Environmental monitoring KPI dashboard
 *
 * MATCHES USER INPUTS LIKE:
 *   "dashboard overview of environmental monitoring data"
 *   "summary dashboard with key metrics and charts"
 *   "data dashboard for a research or government project"
 *   "KPI cards with bar charts and recent readings"
 *   "monitoring summary page with alerts and statistics"
 *   "data overview page with charts and status indicators"
 *   "annual summary dashboard with trends and totals"
 *
 * DEMONSTRATES:
 *   - KPI stat cards (total readings, active towers, alerts, data coverage)
 *   - BarChart comparing measurement averages by tower
 *   - Recent alerts table with severity colouring
 *   - Tailwind grid layout, no inline styles
 */
import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const KPI_CARDS = [
  { label: 'Total Readings',   value: '148,230', delta: '+3.2%',  trend: 'up',   icon: '📊', color: 'bg-blue-50  text-blue-700'  },
  { label: 'Active Towers',    value: '34 / 37', delta: '3 offline', trend: 'down', icon: '📡', color: 'bg-green-50 text-green-700' },
  { label: 'Active Alerts',    value: '7',       delta: '-2 today',  trend: 'down', icon: '🔔', color: 'bg-red-50   text-red-700'   },
  { label: 'Data Coverage',    value: '97.4 %',  delta: '+0.6%',  trend: 'up',   icon: '✅', color: 'bg-teal-50  text-teal-700'  },
];

const TOWER_AVERAGES = [
  { tower: 'T01', temp: 14.2, humidity: 68, wind: 4.1 },
  { tower: 'T02', temp: 13.8, humidity: 71, wind: 5.2 },
  { tower: 'T03', temp: 15.1, humidity: 65, wind: 3.8 },
  { tower: 'T04', temp: 12.9, humidity: 74, wind: 6.0 },
  { tower: 'T05', temp: 14.7, humidity: 69, wind: 4.5 },
  { tower: 'T06', temp: 13.5, humidity: 72, wind: 5.7 },
];

const RECENT_ALERTS = [
  { id: 'A-041', tower: 'T04', message: 'Wind speed exceeded 9 m/s threshold', severity: 'high',   time: '08:14' },
  { id: 'A-040', tower: 'T02', message: 'Data gap > 30 min detected',           severity: 'medium', time: '06:52' },
  { id: 'A-039', tower: 'T06', message: 'Humidity sensor reading inconsistent',  severity: 'medium', time: 'Yesterday' },
  { id: 'A-038', tower: 'T01', message: 'Battery level below 20%',              severity: 'low',    time: 'Yesterday' },
];

const SEVERITY_STYLE = {
  high:   'bg-red-100    text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-gray-100   text-gray-600',
};

const [activeChart, setActiveChartState] = ['temp', () => {}];

export default function MonitoringDashboard() {
  const [metric, setMetric] = useState('temp');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Monitoring Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Last updated: {new Date().toLocaleString()} · {TOWER_AVERAGES.length} towers reporting
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl p-5 shadow-sm ${kpi.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{kpi.icon}</span>
              <span className={`text-xs font-medium ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-500'}`}>
                {kpi.delta}
              </span>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs opacity-75 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Tower Averages</h2>
            <div className="flex gap-2">
              {['temp', 'humidity', 'wind'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    metric === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {m === 'temp' ? 'Temp' : m === 'humidity' ? 'Humidity' : 'Wind'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={TOWER_AVERAGES}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="tower" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar
                dataKey={metric}
                fill={metric === 'temp' ? '#ef4444' : metric === 'humidity' ? '#3b82f6' : '#10b981'}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent alerts */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Recent Alerts</h2>
          <ul className="space-y-3">
            {RECENT_ALERTS.map((alert) => (
              <li key={alert.id} className="flex gap-3 text-sm">
                <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 h-fit ${SEVERITY_STYLE[alert.severity]}`}>
                  {alert.severity}
                </span>
                <div>
                  <p className="font-medium text-gray-800">{alert.tower} — {alert.message}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{alert.id} · {alert.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
