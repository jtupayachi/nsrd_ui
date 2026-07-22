/**
 * GOLDEN EXAMPLE — Leaflet map with Polyline connecting sites + side panel
 * Demonstrates: Polyline, useMap hook, fitBounds, side-by-side layout
 * Styling: Tailwind CSS — MapContainer keeps style={{height}} (Leaflet requirement)
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const ROUTE_CSV = `stop,lat,lng,name,elevation_m
1,35.930,-84.380,Trailhead,320
2,35.938,-84.372,Ridge Viewpoint,410
3,35.945,-84.360,Pine Grove,390
4,35.952,-84.348,Summit,450
5,35.960,-84.335,North Camp,380`;

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

function FitRoute({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions));
    }
  }, [positions, map]);
  return null;
}

export default function LeafletPolyline() {
  const [stops, setStops] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setStops(parseCSV(ROUTE_CSV));
  }, []);

  const positions = stops.map(s => [s.lat, s.lng]);

  return (
    <div className="flex gap-4 p-4 h-[560px]">
      {/* Side panel */}
      <div className="w-[220px] flex-shrink-0 overflow-y-auto bg-gray-100 rounded-lg p-3">
        <h3 className="font-semibold mb-3">Route Stops</h3>
        {stops.map(s => (
          <div
            key={s.stop}
            onClick={() => setSelected(s)}
            className={`px-3 py-2 mb-1 rounded-md cursor-pointer text-sm transition-colors ${
              selected?.stop === s.stop
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
          >
            <strong>{s.stop}. {s.name}</strong><br />
            Elev: {s.elevation_m}m
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer
          center={[35.93, -84.38]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
          />
          <FitRoute positions={positions} />
          {positions.length > 1 && (
            <Polyline positions={positions} pathOptions={{ color: '#007aff', weight: 3 }} />
          )}
          {stops.map((s, i) => (
            <Marker key={i} position={[s.lat, s.lng]}>
              <Popup>
                <strong>{s.name}</strong><br />
                Elevation: {s.elevation_m}m
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
