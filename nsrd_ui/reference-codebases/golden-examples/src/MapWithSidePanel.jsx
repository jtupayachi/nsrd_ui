/**
 * GOLDEN EXAMPLE — Leaflet map with clickable markers + side detail panel
 * Demonstrates: useState for selected item, map + side panel layout,
 *               CircleMarker onClick, conditional detail panel, useMap for flyTo
 * Styling: Tailwind CSS — MapContainer keeps style={{height}} (Leaflet requirement)
 *
 * KEY PATTERN:
 *   - Map on the left (or full width with overlay panel)
 *   - Click a marker → sets selectedSite in state
 *   - Side panel re-renders with the selected site's details
 *   - useMap() hook + flyTo() smoothly pans to selected site
 *
 * RULES:
 *   - CircleMarker uses center={[lat,lng]}, NOT position={[lat,lng]}
 *   - useMap() must be used inside a component rendered INSIDE <MapContainer>
 *   - Do NOT call useMap() in the parent component — it will throw
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const CSV_DATA = `site_id,name,lat,lng,status,value,unit
T01,Tower Alpha,35.930,-84.380,active,42.1,ppb
T02,Tower Beta,35.945,-84.355,active,18.7,ppb
T03,Tower Gamma,35.915,-84.405,warning,93.4,ppb
T04,Tower Delta,35.960,-84.330,active,61.2,ppb
T05,Tower Epsilon,35.900,-84.420,inactive,0.0,ppb
T06,Tower Zeta,35.975,-84.310,active,55.9,ppb`;

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

const STATUS_COLOR = {
  active:   '#22c55e',
  warning:  '#f59e0b',
  inactive: '#9ca3af',
};

// useMap() must be called INSIDE MapContainer, so we use a child component
function FlyToSite({ site }) {
  const map = useMap();
  useEffect(() => {
    if (site) {
      map.flyTo([site.lat, site.lng], 14, { duration: 1 });
    }
  }, [site, map]);
  return null;
}

export default function MapWithSidePanel() {
  const [sites, setSites]       = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setSites(parseCSV(CSV_DATA));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Site Monitor</h1>
        <p className="text-gray-500 text-sm">Click a marker or list item to see details</p>
      </div>

      <div className="flex gap-4" style={{ height: '520px' }}>
        {/* Site list — left sidebar */}
        <div className="w-52 flex-shrink-0 overflow-y-auto bg-white rounded-2xl shadow-sm p-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1 mb-1">Sites</p>
          {sites.map(site => (
            <button
              key={site.site_id}
              onClick={() => setSelected(site)}
              className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-colors text-sm ${
                selected?.site_id === site.site_id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                style={{ background: STATUS_COLOR[site.status] || '#9ca3af' }}
              />
              {site.name}
            </button>
          ))}
        </div>

        {/* Map — fills remaining space */}
        <div className="flex-1 rounded-2xl overflow-hidden shadow-sm">
          <MapContainer
            center={[35.93, -84.37]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
            />

            {/* FlyToSite re-renders when selected changes — must be inside MapContainer */}
            <FlyToSite site={selected} />

            {sites.map(site => (
              <CircleMarker
                key={site.site_id}
                center={[site.lat, site.lng]}
                radius={selected?.site_id === site.site_id ? 14 : 9}
                pathOptions={{
                  color:       STATUS_COLOR[site.status] || '#9ca3af',
                  fillColor:   STATUS_COLOR[site.status] || '#9ca3af',
                  fillOpacity: 0.8,
                  weight:      selected?.site_id === site.site_id ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => setSelected(site) }}
              >
                <Popup>
                  <strong>{site.name}</strong><br />
                  Value: {site.value} {site.unit}<br />
                  Status: {site.status}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Detail panel — appears when a site is selected */}
        {selected && (
          <div className="w-60 flex-shrink-0 bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">{selected.name}</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white mb-4"
              style={{ background: STATUS_COLOR[selected.status] || '#9ca3af' }}
            >
              {selected.status}
            </span>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-gray-400 uppercase">Site ID</dt>
                <dd className="font-medium text-gray-800">{selected.site_id}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Measurement</dt>
                <dd className="font-medium text-gray-800">{selected.value} {selected.unit}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase">Coordinates</dt>
                <dd className="font-medium text-gray-800">{selected.lat}, {selected.lng}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
