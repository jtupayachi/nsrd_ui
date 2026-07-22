/**
 * GOLDEN EXAMPLE — Leaflet map with color-coded circle markers (value heatmap style)
 * Demonstrates: CircleMarker, dynamic color scale, CSV parsing, legend
 * Styling: Tailwind CSS — MapContainer keeps style={{height}} (Leaflet requirement)
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const CSV_DATA = `site,lat,lng,concentration,unit
Alpha,35.930,-84.380,12.4,ppb
Beta,35.945,-84.355,45.2,ppb
Gamma,35.915,-84.405,8.1,ppb
Delta,35.960,-84.330,78.9,ppb
Epsilon,35.900,-84.420,33.5,ppb
Zeta,35.975,-84.310,91.0,ppb
Eta,35.885,-84.440,5.3,ppb`;

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

function getColor(value, min, max) {
  const ratio = (value - min) / (max - min);
  const r = Math.round(255 * ratio);
  const b = Math.round(255 * (1 - ratio));
  return `rgb(${r},0,${b})`;
}

export default function LeafletHeatPoints() {
  const [sites, setSites] = useState([]);

  useEffect(() => {
    const parsed = parseCSV(CSV_DATA);
    setSites(parsed);
  }, []);

  const values = sites.map(s => s.concentration);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-2">Concentration Map</h2>
      <p className="text-gray-500 text-sm mb-4">
        Color indicates concentration level: <span className="text-blue-600 font-medium">■ low</span> → <span className="text-red-500 font-medium">■ high</span>
      </p>
      <MapContainer
        center={[35.93, -84.38]}
        zoom={11}
        style={{ height: '500px', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
        />
        {sites.map((site, i) => (
          <CircleMarker
            key={i}
            center={[site.lat, site.lng]}
            radius={12}
            pathOptions={{
              color: getColor(site.concentration, min, max),
              fillColor: getColor(site.concentration, min, max),
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{site.site}</strong><br />
              Concentration: {site.concentration} {site.unit}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
