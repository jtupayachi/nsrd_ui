/**
 * GOLDEN EXAMPLE — Monitoring tower map + scatter plot on same page
 *
 * MATCHES USER INPUTS LIKE:
 *   "map visualization of tower locations in a study area"
 *   "show sensor tower locations on a map with status"
 *   "scatter plot and map of monitoring station data"
 *   "tower data map for a reservation or managed area"
 *   "field instrument locations with readings and chart"
 *   "monitoring network map with data visualization"
 *   "interactive map showing measurement sites"
 *   "geo map with scatter plot of tower measurements"
 *   "map with status colors ok warning alert"
 *
 * CSV COLUMNS THIS HANDLES:
 *   tower, lat, lng        → CircleMarker positions on map
 *   status                 → colour coding: ok=green, warning=amber, alert=red
 *   height_m               → X axis of scatter plot
 *   value, reading, measurement → Y axis of scatter plot
 *   site, station, id      → treated as tower identifier
 *
 * SVG LAYOUT REGIONS THIS HANDLES:
 *   map, map-panel, map-container     → Leaflet MapContainer left side
 *   chart, scatter, plot, graph       → Recharts ScatterChart right side
 *   table, data-table, readings       → summary table below chart
 *   legend, status-legend             → colour legend above map
 *   sidebar (right)                   → chart + table panel
 *   two-column, split, left-right     → grid grid-cols-2 layout
 *
 * DEMONSTRATES:
 *   - Leaflet map with CircleMarker per tower (colour = status)
 *   - Status legend (ok / warning / alert)
 *   - Recharts ScatterChart next to the map
 *   - CSV parsed inline: tower, lat, lng, height_m, value, status
 *   - Tailwind two-column layout (map left, chart right)
 *   - Popup with tower details on click
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// Inline CSV — replace with fetch('/data/towers.csv') for real data
const TOWER_CSV = `tower,lat,lng,height_m,value,status
T01,35.9332,-84.3883,40,2.34,ok
T02,35.9510,-84.3500,60,5.81,warning
T03,35.9150,-84.4120,30,1.12,ok
T04,35.9700,-84.3200,80,9.47,alert
T05,35.8900,-84.4300,50,3.66,ok
T06,35.9420,-84.3750,45,6.20,warning
T07,35.9600,-84.3600,35,0.98,ok`;

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

const STATUS_COLOR = { ok: '#16a34a', warning: '#d97706', alert: '#dc2626' };

export default function MonitoringTowerMap() {
  const [towers, setTowers] = useState([]);

  useEffect(() => { setTowers(parseCSV(TOWER_CSV)); }, []);

  const center = towers.length
    ? [towers.reduce((s, t) => s + t.lat, 0) / towers.length,
       towers.reduce((s, t) => s + t.lng, 0) / towers.length]
    : [35.93, -84.38];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Monitoring Tower Network</h1>
      <p className="text-gray-500 text-sm mb-6">
        {towers.length} towers · circle colour indicates operational status
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Tower Locations</h2>
            <div className="flex gap-3 text-xs">
              {Object.entries(STATUS_COLOR).map(([s, c]) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background: c }} />
                  {s}
                </span>
              ))}
            </div>
          </div>
          <MapContainer
            center={center}
            zoom={11}
            style={{ height: '420px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
            />
            {towers.map((t) => (
              <CircleMarker
                key={t.tower}
                center={[t.lat, t.lng]}
                radius={10}
                pathOptions={{
                  color: STATUS_COLOR[t.status] || '#6b7280',
                  fillColor: STATUS_COLOR[t.status] || '#6b7280',
                  fillOpacity: 0.8,
                }}
              >
                <Popup>
                  <strong>{t.tower}</strong><br />
                  Height: {t.height_m} m<br />
                  Value: {t.value}<br />
                  Status: <span style={{ color: STATUS_COLOR[t.status] }}>{t.status}</span>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Scatter chart: height vs value */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Height vs. Measured Value</h2>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="height_m" name="Height (m)" unit=" m" />
              <YAxis dataKey="value" name="Value" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter name="Towers" data={towers} fill="#2563eb" />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Summary table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
                <tr>
                  <th className="py-2 pr-4">Tower</th>
                  <th className="py-2 pr-4">Height</th>
                  <th className="py-2 pr-4">Value</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {towers.map((t) => (
                  <tr key={t.tower} className="border-b border-gray-100">
                    <td className="py-1 pr-4 font-medium text-gray-800">{t.tower}</td>
                    <td className="py-1 pr-4 text-gray-600">{t.height_m} m</td>
                    <td className="py-1 pr-4 text-gray-600">{t.value}</td>
                    <td className="py-1">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ background: STATUS_COLOR[t.status] || '#6b7280' }}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
