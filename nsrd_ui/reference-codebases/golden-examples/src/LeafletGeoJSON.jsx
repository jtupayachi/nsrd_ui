/**
 * GOLDEN EXAMPLE — Leaflet GeoJSON polygon layer (watershed/boundary)
 * Demonstrates: GeoJSON component, style function, onEachFeature, layer highlight
 * Styling: Tailwind CSS — MapContainer keeps style={{height}} (Leaflet requirement)
 */
import React, { useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Inline GeoJSON (watersheds as polygons)
const WATERSHED_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Bear Creek', area_km2: 142.3, quality: 'Good' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-84.42, 35.89], [-84.38, 35.89], [-84.36, 35.93],
          [-84.38, 35.97], [-84.42, 35.97], [-84.44, 35.93],
          [-84.42, 35.89]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Pine Fork', area_km2: 87.6, quality: 'Fair' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-84.34, 35.90], [-84.30, 35.90], [-84.28, 35.94],
          [-84.30, 35.98], [-84.34, 35.98], [-84.36, 35.94],
          [-84.34, 35.90]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Eagle Run', area_km2: 203.1, quality: 'Poor' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-84.25, 35.88], [-84.21, 35.88], [-84.19, 35.92],
          [-84.21, 35.96], [-84.25, 35.96], [-84.27, 35.92],
          [-84.25, 35.88]
        ]]
      }
    }
  ]
};

const QUALITY_COLORS = { Good: '#34c759', Fair: '#ff9f0a', Poor: '#ff3b30' };

function geoStyle(feature) {
  const color = QUALITY_COLORS[feature.properties.quality] || '#999';
  return {
    fillColor: color,
    fillOpacity: 0.4,
    color: color,
    weight: 2,
  };
}

export default function WatershedMap() {
  const [selected, setSelected] = useState(null);

  function onEachFeature(feature, layer) {
    layer.on({
      click: () => setSelected(feature.properties),
      mouseover: e => e.target.setStyle({ fillOpacity: 0.7, weight: 3 }),
      mouseout: e => e.target.setStyle({ fillOpacity: 0.4, weight: 2 }),
    });
    layer.bindTooltip(feature.properties.name, { permanent: false, direction: 'center' });
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Watershed Boundaries</h2>

      {selected && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex items-center gap-8">
          <div>
            <strong className="text-lg">{selected.name}</strong>
            <p className="text-gray-500 text-sm mt-0.5">Area: {selected.area_km2} km²</p>
          </div>
          <span
            className="px-3 py-1 rounded-full font-bold text-sm"
            style={{
              background: QUALITY_COLORS[selected.quality] + '20',
              color: QUALITY_COLORS[selected.quality],
            }}
          >
            {selected.quality} Quality
          </span>
        </div>
      )}

      <MapContainer
        center={[35.93, -84.33]}
        zoom={11}
        style={{ height: '480px', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
        />
        <GeoJSON
          data={WATERSHED_GEOJSON}
          style={geoStyle}
          onEachFeature={onEachFeature}
        />
      </MapContainer>

      <div className="flex gap-4 mt-3">
        {Object.entries(QUALITY_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5 text-sm">
            <span className="w-3.5 h-3.5 rounded-sm inline-block" style={{ background: c }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
