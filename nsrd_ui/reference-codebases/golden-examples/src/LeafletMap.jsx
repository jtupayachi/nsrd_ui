/**
 * GOLDEN EXAMPLE — React Leaflet map with CSV markers
 * Demonstrates: MapContainer, TileLayer, Marker, Popup, CSV parsing
 * This is a CORRECT, COMPILABLE reference. Follow this pattern exactly.
 * Styling: Tailwind CSS — MapContainer keeps style={{height}} (Leaflet requirement)
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons (required for Vite/webpack builds)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Inline CSV data (parse at component init)
const CSV_DATA = `name,lat,lng,value
Site A,35.93,-84.38,42.1
Site B,35.95,-84.35,18.7
Site C,35.91,-84.40,93.4
Site D,35.97,-84.32,61.2`;

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      obj[h.trim()] = vals[i]?.trim() ?? '';
      return obj;
    }, {});
  });
}

export default function LeafletMap() {
  const [sites, setSites] = useState([]);

  useEffect(() => {
    setSites(parseCSV(CSV_DATA));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-3">Site Map</h2>
      {/* MapContainer MUST have an explicit height — otherwise map is invisible */}
      <MapContainer
        center={[35.93, -84.38]}
        zoom={11}
        style={{ height: '500px', width: '100%' }}
      >
        {/* TileLayer: url and attribution are props on the same tag, NOT children */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
        />
        {sites.map((site, idx) => (
          <Marker key={idx} position={[parseFloat(site.lat), parseFloat(site.lng)]}>
            <Popup>
              <strong>{site.name}</strong><br />
              Value: {site.value}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
