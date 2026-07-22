/**
 * GOLDEN EXAMPLE — Multi-site comparison map with bar chart + sortable table
 *
 * MATCHES USER INPUTS LIKE:
 *   "compare values across monitoring sites on a map"
 *   "bar chart comparing sites side by side with map"
 *   "ranked bar chart of sites with their locations"
 *   "which sites have the highest readings, show on map"
 *   "site ranking with geographic context"
 *   "compare multiple locations bar chart and map"
 *   "sites with lat lng and one measurement, compare them"
 *   "spatial comparison of field sites"
 *
 * USE THIS TEMPLATE WHEN:
 *   - CSV has one row per site (no time series, each site appears once)
 *   - Or data summarized to one value per site (e.g. average, total)
 *   - User wants to compare/rank sites by a numeric metric
 *   - No date/time column, or only a single snapshot date
 *
 * CSV COLUMNS THIS HANDLES:
 *   lat, latitude       → CircleMarker position (colored by value)
 *   lng, lon, longitude → CircleMarker position
 *   site, station, name → site label
 *   Any numeric column  → metric for comparison
 *   Optional: region, type, category → grouping/filtering
 *
 * DEMONSTRATES:
 *   - Choropleth-style CircleMarker colored by metric value (color scale)
 *   - Click marker highlights same site in bar chart + table
 *   - Recharts BarChart sorted by value descending
 *   - Sortable summary table with rank column
 *   - Metric selector for multiple numeric columns
 *   - CircleMarker uses center={[lat,lng]} — NEVER position=
 */
import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const DATA_CSV = `site_id,site_name,latitude,longitude,region,avg_temperature_c,avg_humidity_pct,avg_wind_ms,total_days
T01,North Ridge,35.9332,-84.3883,North,6.2,74,3.9,90
T02,East Hollow,35.9510,-84.3500,East,5.8,76,5.2,90
T03,South Slope,35.9150,-84.4120,South,7.5,66,3.1,88
T04,West Plateau,35.9280,-84.4350,West,5.1,80,2.8,90
T05,Central Basin,35.9400,-84.3900,Central,6.9,71,4.4,85
T06,Pine Summit,35.9600,-84.3700,North,4.8,82,6.1,90
T07,Oak Valley,35.9050,-84.3650,East,7.2,68,3.7,87
T08,Maple Creek,35.9480,-84.4200,West,6.5,73,4.1,90`;

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
  { key: 'avg_temperature_c',  label: 'Avg Temp (°C)',    unit: '°C' },
  { key: 'avg_humidity_pct',   label: 'Avg Humidity (%)', unit: '%'  },
  { key: 'avg_wind_ms',        label: 'Avg Wind (m/s)',   unit: 'm/s'},
];

// Map metric value to a color (blue → yellow → red scale)
function valueToColor(value, min, max) {
  const t = max > min ? (value - min) / (max - min) : 0.5;
  if (t < 0.33) return '#3b82f6';  // blue (low)
  if (t < 0.66) return '#f59e0b';  // amber (mid)
  return '#ef4444';                 // red (high)
}

const SORT_OPTIONS = ['Value (high→low)', 'Value (low→high)', 'Name (A→Z)'];

export default function SiteComparisonMap() {
  const data = useMemo(() => parseCSV(DATA_CSV), []);
  const [metric, setMetric]           = useState(METRICS[0].key);
  const [selectedSite, setSelectedSite] = useState(null);
  const [sortBy, setSortBy]           = useState(0);
  const [regionFilter, setRegionFilter] = useState('All');

  const activeMetric = METRICS.find(m => m.key === metric) || METRICS[0];
  const regions = useMemo(() => ['All', ...new Set(data.map(r => r.region))], [data]);

  const filtered = useMemo(() =>
    regionFilter === 'All' ? data : data.filter(r => r.region === regionFilter),
    [data, regionFilter]);

  const values = filtered.map(r => r[metric]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 0) return arr.sort((a, b) => b[metric] - a[metric]);
    if (sortBy === 1) return arr.sort((a, b) => a[metric] - b[metric]);
    return arr.sort((a, b) => a.site_name.localeCompare(b.site_name));
  }, [filtered, sortBy, metric]);

  const mapCenter = data.length
    ? [data.reduce((s, r) => s + r.latitude, 0) / data.length,
       data.reduce((s, r) => s + r.longitude, 0) / data.length]
    : [35.93, -84.38];

  const topSite   = sorted[0];
  const avgValue  = values.length ? (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1) : '—';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Site Comparison Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {filtered.length} sites · Click a site to highlight across views
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Sites</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Average {activeMetric.label}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{avgValue} {activeMetric.unit}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Highest Site</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {topSite ? `${topSite.site_name} (${topSite[metric]}${activeMetric.unit})` : '—'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">Metric:</span>
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                metric === m.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
              }`}
            >
              {m.label.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-600">Region:</span>
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
          >
            {regions.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map — markers colored by metric value */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Site Map</h2>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Low
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block ml-1" /> Mid
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block ml-1" /> High
            </div>
          </div>
          <MapContainer
            center={mapCenter}
            zoom={11}
            style={{ height: '380px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
            />
            {/* CircleMarker uses center={[lat,lng]} — never position= */}
            {filtered.map(site => {
              const color = valueToColor(site[metric], minVal, maxVal);
              const isSelected = selectedSite === site.site_id;
              return (
                <CircleMarker
                  key={site.site_id}
                  center={[site.latitude, site.longitude]}
                  radius={isSelected ? 16 : 10}
                  pathOptions={{
                    color: isSelected ? '#1d4ed8' : color,
                    fillColor: color,
                    fillOpacity: 0.85,
                    weight: isSelected ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => setSelectedSite(site.site_id) }}
                >
                  <Popup>
                    <strong>{site.site_name}</strong><br />
                    {activeMetric.label}: <strong>{site[metric]}{activeMetric.unit}</strong><br />
                    Region: {site.region}
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Bar chart — sorted by metric */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Site Comparison</h2>
            <select
              value={sortBy}
              onChange={e => setSortBy(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600"
            >
              {SORT_OPTIONS.map((o, i) => <option key={i} value={i}>{o}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 20, left: 70, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="site_name" tick={{ fontSize: 11 }} width={65} />
              <Tooltip
                formatter={(val) => [`${val} ${activeMetric.unit}`, activeMetric.label]}
              />
              <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
                {sorted.map(site => (
                  <Cell
                    key={site.site_id}
                    fill={selectedSite === site.site_id
                      ? '#1d4ed8'
                      : valueToColor(site[metric], minVal, maxVal)}
                    onClick={() => setSelectedSite(site.site_id)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mt-6 overflow-x-auto">
        <h2 className="font-semibold text-gray-800 mb-3">Site Details</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
              <th className="py-2 pr-4">Rank</th>
              <th className="py-2 pr-4">Site</th>
              <th className="py-2 pr-4">Region</th>
              {METRICS.map(m => (
                <th key={m.key} className={`py-2 pr-4 ${m.key === metric ? 'text-blue-600 font-bold' : ''}`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((site, idx) => (
              <tr
                key={site.site_id}
                onClick={() => setSelectedSite(site.site_id)}
                className={`border-b border-gray-50 cursor-pointer transition-colors ${
                  selectedSite === site.site_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="py-2 pr-4 font-medium text-gray-400">{idx + 1}</td>
                <td className="py-2 pr-4 font-semibold text-gray-900">{site.site_name}</td>
                <td className="py-2 pr-4 text-gray-600">{site.region}</td>
                {METRICS.map(m => (
                  <td key={m.key} className={`py-2 pr-4 ${m.key === metric ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}>
                    {site[m.key]}{m.unit}
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
