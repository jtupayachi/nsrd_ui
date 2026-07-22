/**
 * GOLDEN EXAMPLE — Map + table side by side, click-to-highlight sync
 * Demonstrates: shared state between map and table, map flyTo on row click
 * Styling: Tailwind CSS — MapContainer keeps style={{height}} (Leaflet requirement)
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const CSV_DATA = `id,name,lat,lng,type,reading,unit
1,Tower A,35.930,-84.380,CO2,412.3,ppm
2,Tower B,35.945,-84.355,CO2,408.7,ppm
3,Tower C,35.920,-84.405,CH4,1923.4,ppb
4,Tower D,35.960,-84.330,CO2,415.1,ppm
5,Tower E,35.975,-84.310,CH4,1887.2,ppb`;

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      const v = vals[i]?.trim();
      obj[h] = isNaN(v) || h === 'id' || h === 'name' || h === 'type' || h === 'unit' ? v : Number(v);
      return obj;
    }, {});
  });
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 13, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function MapTableSync() {
  const [sites, setSites] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setSites(parseCSV(CSV_DATA));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Flux Tower Network</h2>
      <div className="flex gap-4 h-[500px]">

        {/* Table */}
        <div className="w-[340px] flex-shrink-0 overflow-y-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 sticky top-0">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Reading</th>
              </tr>
            </thead>
            <tbody>
              {sites.map(site => (
                <tr
                  key={site.id}
                  onClick={() => setSelected(site)}
                  className={`cursor-pointer border-b border-gray-200 transition-colors ${
                    selected?.id === site.id
                      ? 'bg-blue-50 border-l-4 border-l-blue-500'
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <td className="px-3 py-2"><strong>{site.name}</strong></td>
                  <td className="px-3 py-2 text-gray-500">{site.type}</td>
                  <td className="px-3 py-2 text-right">
                    {site.reading} <span className="text-gray-400">{site.unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Map */}
        <div className="flex-1">
          <MapContainer
            center={[35.94, -84.36]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
            />
            <FlyTo target={selected} />
            {sites.map(site => (
              <Marker
                key={site.id}
                position={[site.lat, site.lng]}
                eventHandlers={{ click: () => setSelected(site) }}
              >
                <Popup>
                  <strong>{site.name}</strong><br />
                  {site.type}: {site.reading} {site.unit}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
