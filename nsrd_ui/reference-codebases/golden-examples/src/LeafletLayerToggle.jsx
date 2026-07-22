/**
 * GOLDEN EXAMPLE — Leaflet with layer groups and toggle controls
 * Demonstrates: LayerGroup, custom icon, layer show/hide state
 * Styling: Tailwind CSS — MapContainer keeps style={{height}} (Leaflet requirement)
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, LayerGroup, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MONITORING_CSV = `id,type,lat,lng,label,radius_m
1,air,35.930,-84.380,Air Station 1,500
2,air,35.945,-84.355,Air Station 2,500
3,water,35.920,-84.400,Water Gauge 1,300
4,water,35.960,-84.320,Water Gauge 2,300
5,soil,35.935,-84.370,Soil Plot A,200
6,soil,35.950,-84.345,Soil Plot B,200`;

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      const v = vals[i]?.trim();
      obj[h] = isNaN(v) || h === 'id' || h === 'label' || h === 'type' ? v : Number(v);
      return obj;
    }, {});
  });
}

const LAYER_CONFIG = {
  air:   { color: '#007aff', label: 'Air Monitoring' },
  water: { color: '#5ac8fa', label: 'Water Gauges' },
  soil:  { color: '#a2845e', label: 'Soil Plots' },
};

export default function LayeredMap() {
  const [sites, setSites] = useState([]);
  const [visibleLayers, setVisibleLayers] = useState(new Set(['air', 'water', 'soil']));

  useEffect(() => {
    setSites(parseCSV(MONITORING_CSV));
  }, []);

  function toggleLayer(type) {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Environmental Monitoring Network</h2>

      {/* Layer toggles */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {Object.entries(LAYER_CONFIG).map(([type, cfg]) => (
          <label key={type} className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={visibleLayers.has(type)}
              onChange={() => toggleLayer(type)}
              className="cursor-pointer"
            />
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: cfg.color }} />
            {cfg.label}
          </label>
        ))}
      </div>

      <MapContainer
        center={[35.94, -84.36]}
        zoom={11}
        style={{ height: '480px', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
        />

        {Object.keys(LAYER_CONFIG).map(type => (
          visibleLayers.has(type) && (
            <LayerGroup key={type}>
              {sites.filter(s => s.type === type).map(site => (
                <React.Fragment key={site.id}>
                  <Circle
                    center={[site.lat, site.lng]}
                    radius={site.radius_m}
                    pathOptions={{
                      color: LAYER_CONFIG[type].color,
                      fillColor: LAYER_CONFIG[type].color,
                      fillOpacity: 0.2,
                      weight: 1,
                    }}
                  />
                  <Marker position={[site.lat, site.lng]}>
                    <Popup>
                      <strong>{site.label}</strong><br />
                      Type: {LAYER_CONFIG[type].label}<br />
                      Radius: {site.radius_m}m
                    </Popup>
                  </Marker>
                </React.Fragment>
              ))}
            </LayerGroup>
          )
        ))}
      </MapContainer>
    </div>
  );
}
