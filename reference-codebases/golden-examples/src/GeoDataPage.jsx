/**
 * GOLDEN EXAMPLE — React Leaflet with both map AND recharts on same page
 * Demonstrates: combining MapContainer + Recharts in one component, CSV shared data
 * This is a CORRECT, COMPILABLE reference. Follow this pattern exactly.
 * Styling: Tailwind CSS — MapContainer keeps style={{height}} (Leaflet requirement)
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TOWER_CSV = `tower,lat,lng,height_m,readings
MT1,35.93317,-84.38833,40,128
MT2,35.95100,-84.35000,60,245
MT3,35.91500,-84.41200,30,89
MT4,35.97000,-84.32000,80,312
MT5,35.89000,-84.43000,50,176`;

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      const v = vals[i]?.trim();
      obj[h.trim()] = isNaN(v) ? v : Number(v);
      return obj;
    }, {});
  });
}

export default function GeoDataPage() {
  const [towers, setTowers] = useState([]);

  useEffect(() => {
    setTowers(parseCSV(TOWER_CSV));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Tower Monitoring</h2>

      {/* Map section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Tower Locations</h3>
        <MapContainer
          center={[35.93, -84.38]}
          zoom={11}
          style={{ height: '400px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
          />
          {towers.map((t, i) => (
            <CircleMarker
              key={i}
              center={[t.lat, t.lng]}
              radius={8}
              pathOptions={{ color: '#007aff', fillColor: '#007aff', fillOpacity: 0.7 }}
            >
              <Popup>
                <strong>{t.tower}</strong><br />
                Height: {t.height_m}m<br />
                Readings: {t.readings}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </section>

      {/* Chart section */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Sensor Readings by Tower</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={towers} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tower" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="readings" fill="#007aff" name="Readings" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
