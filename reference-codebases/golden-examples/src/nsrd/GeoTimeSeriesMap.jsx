/**
 * GOLDEN EXAMPLE — Geo map with clickable sites + time series chart per site
 *
 * MATCHES USER INPUTS LIKE:
 *   "map of monitoring sites with time series chart"
 *   "click tower on map to see its measurements over time"
 *   "sensor locations on a map with time series data"
 *   "map + line chart showing readings over time per site"
 *   "tower data with timestamps, show trend per tower"
 *   "monitoring station time series with geo map"
 *   "select site on map to view historical data"
 *   "spatial data with temporal dimension, map + chart"
 *
 * USE THIS TEMPLATE WHEN:
 *   - CSV has a date/datetime/timestamp column
 *   - Multiple readings per site over time (same lat/lng repeated)
 *   - User wants to see time trends for individual sites
 *
 * CSV COLUMNS THIS HANDLES:
 *   lat, latitude       → CircleMarker position
 *   lng, lon, longitude → CircleMarker position
 *   date, datetime, timestamp, time → X axis of line chart
 *   tower, site, station, id → site identifier for grouping
 *   Any numeric column  → Y axis of line chart (selectable)
 *
 * DEMONSTRATES:
 *   - Deduplicated site markers (one marker per unique lat/lng, not one per row)
 *   - Click marker → selectedSite state → filters data for line chart
 *   - Recharts LineChart with time on X axis
 *   - Metric selector buttons (show different columns)
 *   - KPI summary row (total sites, date range, latest value)
 *   - CircleMarker uses center={[lat,lng]} — NEVER position=
 */
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// Inline CSV — replace content but keep variable name DATA_CSV
const DATA_CSV = `datetime,tower_id,latitude,longitude,temperature_c,humidity_pct,wind_ms
2024-01-01 06:00,T01,35.9332,-84.3883,2.1,82,3.2
2024-01-01 12:00,T01,35.9332,-84.3883,7.4,68,4.5
2024-01-01 18:00,T01,35.9332,-84.3883,5.2,74,3.8
2024-01-02 06:00,T01,35.9332,-84.3883,1.8,85,2.9
2024-01-02 12:00,T01,35.9332,-84.3883,8.1,65,5.1
2024-01-02 18:00,T01,35.9332,-84.3883,6.0,71,4.2
2024-01-01 06:00,T02,35.9510,-84.3500,1.5,88,4.1
2024-01-01 12:00,T02,35.9510,-84.3500,6.8,72,5.6
2024-01-01 18:00,T02,35.9510,-84.3500,4.9,78,5.0
2024-01-02 06:00,T02,35.9510,-84.3500,0.9,90,3.5
2024-01-02 12:00,T02,35.9510,-84.3500,7.2,70,6.2
2024-01-02 18:00,T02,35.9510,-84.3500,5.5,75,5.3
2024-01-01 06:00,T03,35.9150,-84.4120,3.2,79,2.5
2024-01-01 12:00,T03,35.9150,-84.4120,9.1,62,3.1
2024-01-01 18:00,T03,35.9150,-84.4120,6.7,69,2.8
2024-01-02 06:00,T03,35.9150,-84.4120,2.8,83,2.2
2024-01-02 12:00,T03,35.9150,-84.4120,9.8,59,3.6
2024-01-02 18:00,T03,35.9150,-84.4120,7.1,66,3.0`;

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

// Metric columns (all numeric columns that aren't lat/lng/id)
const METRICS = [
  { key: 'temperature_c',  label: 'Temperature (°C)', color: '#ef4444' },
  { key: 'humidity_pct',   label: 'Humidity (%)',      color: '#3b82f6' },
  { key: 'wind_ms',        label: 'Wind (m/s)',         color: '#10b981' },
];

export default function GeoTimeSeriesMap() {
  const [rows, setRows]           = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [metric, setMetric]       = useState(METRICS[0].key);

  useEffect(() => {
    setRows(parseCSV(DATA_CSV));
  }, []);

  // Deduplicate: one entry per unique tower_id with its lat/lng
  const sites = useMemo(() => {
    const seen = {};
    rows.forEach(r => {
      if (!seen[r.tower_id]) seen[r.tower_id] = { id: r.tower_id, lat: r.latitude, lng: r.longitude };
    });
    return Object.values(seen);
  }, [rows]);

  // Set default selection once sites load
  useEffect(() => {
    if (sites.length > 0 && !selectedSite) setSelectedSite(sites[0].id);
  }, [sites]);

  const mapCenter = sites.length
    ? [sites.reduce((s, t) => s + t.lat, 0) / sites.length,
       sites.reduce((s, t) => s + t.lng, 0) / sites.length]
    : [35.93, -84.38];

  // Filter rows for selected site, sorted by datetime
  const chartData = useMemo(() =>
    rows
      .filter(r => r.tower_id === selectedSite)
      .sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)))
      .map(r => ({ ...r, time: String(r.datetime).slice(5, 16) })),
    [rows, selectedSite]);

  const activeMetric = METRICS.find(m => m.key === metric) || METRICS[0];

  // Latest value for selected site
  const latest = chartData.at(-1);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Site Monitoring — Time Series</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {sites.length} sites · {rows.length} total records · Click a site to explore its data
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Selected Site</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{selectedSite || '—'}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-emerald-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Readings</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{chartData.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Latest {activeMetric.label}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {latest ? latest[metric] : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map — circle markers, click selects site */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Site Locations</h2>
            <p className="text-xs text-gray-400 mt-0.5">Click a site to view its time series</p>
          </div>
          <MapContainer
            center={mapCenter}
            zoom={11}
            style={{ height: '400px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
            />
            {/* ONE marker per unique site — CircleMarker uses center={}, NOT position={} */}
            {sites.map(site => (
              <CircleMarker
                key={site.id}
                center={[site.lat, site.lng]}
                radius={selectedSite === site.id ? 14 : 9}
                pathOptions={{
                  color:       selectedSite === site.id ? '#2563eb' : '#64748b',
                  fillColor:   selectedSite === site.id ? '#2563eb' : '#94a3b8',
                  fillOpacity: 0.85,
                  weight:      selectedSite === site.id ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => setSelectedSite(site.id) }}
              >
                <Popup>
                  <strong>{site.id}</strong><br />
                  {site.lat.toFixed(4)}, {site.lng.toFixed(4)}<br />
                  <em>Click to view time series</em>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Time series chart for selected site */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">
              {selectedSite ? `${selectedSite} — Time Series` : 'Select a site'}
            </h2>
            {/* Metric selector */}
            <div className="flex gap-1">
              {METRICS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    metric === m.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {m.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={metric}
                  name={activeMetric.label}
                  stroke={activeMetric.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              Click a site on the map to view its data
            </div>
          )}
        </div>
      </div>

      {/* Site list */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mt-6">
        <h2 className="font-semibold text-gray-800 mb-3">All Sites</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {sites.map(site => (
            <button
              key={site.id}
              onClick={() => setSelectedSite(site.id)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                selectedSite === site.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300'
              }`}
            >
              {site.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
