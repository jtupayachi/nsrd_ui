/**
 * TailwindMapPage.jsx — Golden Example
 *
 * Demonstrates Tailwind CSS alongside react-leaflet:
 *  • Side-panel + map layout using Tailwind flex/grid
 *  • All UI (cards, badges, buttons) uses Tailwind className
 *  • MapContainer uses style={{ height }} — required by Leaflet
 *  • Marker click updates a Tailwind-styled info panel
 *  • CSV data parsed inline
 */

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default Leaflet icon paths (required in Vite)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CSV = `id,name,lat,lng,type,value,status
1,Bear Creek Site A,35.9312,-84.3012,water,7.8,good
2,White Oak Lake,35.9058,-84.2888,water,6.2,moderate
3,ORNL Main Site,35.9300,-84.3100,facility,0,n/a
4,Melton Hill Res.,35.9516,-84.3541,reservoir,8.1,good
5,Clinch River E.,35.8989,-84.1966,river,5.4,moderate
6,Nolichucky Outlet,35.9784,-84.4101,river,9.2,excellent
7,Poplar Creek,35.9388,-84.2453,water,4.1,poor`;

function parseCsv(raw) {
  const rows = raw.trim().split('\n');
  const headers = rows[0].split(',');
  return rows.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      obj[h.trim()] = vals[i]?.trim() ?? '';
      return obj;
    }, {});
  });
}

const SITES = parseCsv(CSV).map(r => ({
  ...r,
  lat: parseFloat(r.lat),
  lng: parseFloat(r.lng),
  value: parseFloat(r.value) || 0,
}));

const STATUS_COLORS = {
  good: { circle: '#22c55e', badge: 'bg-green-100 text-green-700' },
  excellent: { circle: '#16a34a', badge: 'bg-emerald-100 text-emerald-700' },
  moderate: { circle: '#f59e0b', badge: 'bg-amber-100 text-amber-700' },
  poor: { circle: '#ef4444', badge: 'bg-red-100 text-red-700' },
  'n/a': { circle: '#94a3b8', badge: 'bg-gray-100 text-gray-500' },
};

export default function TailwindMapPage() {
  const [selected, setSelected] = useState(null);

  const active = SITES.find(s => s.id === selected?.id) ?? null;

  return (
    <div className="flex h-[calc(100vh-52px)] bg-gray-50">

      {/* ── Left panel ─────────────────────── */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="text-base font-bold text-gray-900">Monitoring Sites</h1>
          <p className="text-xs text-gray-500 mt-0.5">{SITES.length} active locations</p>
        </div>

        {/* Site list */}
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {SITES.map(site => {
            const sc = STATUS_COLORS[site.status] ?? STATUS_COLORS['n/a'];
            const isActive = selected?.id === site.id;
            return (
              <li
                key={site.id}
                onClick={() => setSelected(isActive ? null : site)}
                className={`px-4 py-3 cursor-pointer transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-900 truncate">{site.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${sc.badge}`}>
                    {site.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {site.type}{site.value > 0 ? ` · DO: ${site.value} mg/L` : ''}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Detail card */}
        {active && (
          <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
            <h3 className="font-bold text-gray-900 text-sm mb-2">{active.name}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-gray-500">Type</dt>
              <dd className="text-gray-900 capitalize font-medium">{active.type}</dd>
              <dt className="text-gray-500">DO Level</dt>
              <dd className="text-gray-900 font-medium">{active.value > 0 ? `${active.value} mg/L` : '—'}</dd>
              <dt className="text-gray-500">Status</dt>
              <dd className={`font-semibold capitalize ${STATUS_COLORS[active.status]?.badge.split(' ')[1]}`}>{active.status}</dd>
              <dt className="text-gray-500">Coords</dt>
              <dd className="text-gray-600">{active.lat.toFixed(4)}, {active.lng.toFixed(4)}</dd>
            </dl>
          </div>
        )}
      </aside>

      {/* ── Map ────────────────────────────── */}
      <div className="flex-1">
        {/* MapContainer MUST have explicit height — use style prop */}
        <MapContainer
          center={[35.93, -84.31]}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`}
          />
          {SITES.map(site => {
            const color = STATUS_COLORS[site.status]?.circle ?? '#94a3b8';
            return (
              <CircleMarker
                key={site.id}
                center={[site.lat, site.lng]}
                radius={selected?.id === site.id ? 12 : 8}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
                eventHandlers={{ click: () => setSelected(selected?.id === site.id ? null : site) }}
              >
                <Popup>
                  <strong>{site.name}</strong><br />
                  {site.value > 0 ? `DO: ${site.value} mg/L · ` : ''}{site.status}
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

    </div>
  );
}
