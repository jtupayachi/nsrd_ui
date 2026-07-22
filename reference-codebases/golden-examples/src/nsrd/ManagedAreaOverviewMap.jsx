/**
 * GOLDEN EXAMPLE — Protected area / managed land overview map
 *
 * MATCHES USER INPUTS LIKE:
 *   "map of a protected area or managed reservation"
 *   "land use map showing zones and boundary"
 *   "managed area with different zones on a map"
 *   "site overview map with zone classification"
 *   "ecological zones map with category legend"
 *   "field sites and zones on interactive map"
 *   "map of research area with land cover types"
 *   "boundary map with monitoring zones colored by type"
 *   "map with clickable zones and detail sidebar"
 *
 * CSV COLUMNS THIS HANDLES:
 *   zone, id, name             → zone identifier label
 *   lat, lng, latitude, longitude → zone centre position on map
 *   category, type, class, land_cover → fill colour grouping
 *   area_ha, area, size        → shown in detail panel
 *   radius                     → Circle radius on map
 *
 * SVG LAYOUT REGIONS THIS HANDLES:
 *   map, map-panel, map-area         → Leaflet MapContainer (2/3 width)
 *   sidebar, detail-panel, info      → right panel: legend + zone detail
 *   legend, category-legend          → colour swatch list per category
 *   detail, zone-info, selected-info → dl/dt/dd detail block
 *   stats, summary-bar               → KPI strip above map
 *   two-column, split, map-sidebar   → grid-cols-3 lg layout
 *
 * DEMONSTRATES:
 *   - Leaflet with Circle overlay per zone (colour = category)
 *   - Clickable zones → info panel updates (sidebar pattern)
 *   - Category legend rendered from data
 *   - Stat summary bar: total area, zone count, categories
 *   - Tailwind layout
 */
import React, { useState } from 'react';
import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const ZONES = [
  { id: 'Z1', name: 'Core Research Zone', lat: 35.940, lng: -84.370, radius: 800, category: 'research',    area_ha: 201 },
  { id: 'Z2', name: 'Buffer Zone North',  lat: 35.960, lng: -84.355, radius: 600, category: 'buffer',     area_ha: 113 },
  { id: 'Z3', name: 'Wetland Reserve',    lat: 35.920, lng: -84.400, radius: 500, category: 'wetland',    area_ha: 78  },
  { id: 'Z4', name: 'Forest Upland',      lat: 35.952, lng: -84.395, radius: 700, category: 'forest',     area_ha: 154 },
  { id: 'Z5', name: 'Transition Corridor',lat: 35.930, lng: -84.335, radius: 450, category: 'transition', area_ha: 64  },
];

const CATEGORY_STYLE = {
  research:   { color: '#1d4ed8', fill: '#3b82f6', label: 'Research Zone' },
  buffer:     { color: '#065f46', fill: '#10b981', label: 'Buffer Zone' },
  wetland:    { color: '#1e40af', fill: '#60a5fa', label: 'Wetland Reserve' },
  forest:     { color: '#14532d', fill: '#4ade80', label: 'Forest / Upland' },
  transition: { color: '#92400e', fill: '#fbbf24', label: 'Transition Area' },
};

export default function ManagedAreaOverviewMap() {
  const [selected, setSelected] = useState(null);

  const totalArea = ZONES.reduce((s, z) => s + z.area_ha, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Site Zone Overview</h1>
      <p className="text-gray-500 text-sm mb-4">
        Managed area · {ZONES.length} zones · {totalArea.toLocaleString()} ha total
      </p>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-blue-600">{ZONES.length}</p>
          <p className="text-xs text-gray-500 mt-1">Management Zones</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-600">{totalArea.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total Hectares</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-teal-600">{Object.keys(CATEGORY_STYLE).length}</p>
          <p className="text-xs text-gray-500 mt-1">Zone Categories</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden">
          <MapContainer
            center={[35.938, -84.370]}
            zoom={12}
            style={{ height: '500px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
            />
            {ZONES.map((zone) => {
              const style = CATEGORY_STYLE[zone.category];
              return (
                <Circle
                  key={zone.id}
                  center={[zone.lat, zone.lng]}
                  radius={zone.radius}
                  pathOptions={{
                    color: style.color,
                    fillColor: style.fill,
                    fillOpacity: selected?.id === zone.id ? 0.75 : 0.45,
                    weight: selected?.id === zone.id ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => setSelected(zone) }}
                >
                  <Popup>
                    <strong>{zone.name}</strong><br />
                    Category: {style.label}<br />
                    Area: {zone.area_ha} ha
                  </Popup>
                </Circle>
              );
            })}
          </MapContainer>
        </div>

        {/* Sidebar: legend + selected zone detail */}
        <div className="flex flex-col gap-4">
          {/* Legend */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Zone Categories</h2>
            <ul className="space-y-2">
              {Object.entries(CATEGORY_STYLE).map(([key, s]) => (
                <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-4 h-4 rounded-sm inline-block shrink-0" style={{ background: s.fill, border: `2px solid ${s.color}` }} />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Selected zone detail */}
          <div className="bg-white rounded-2xl shadow-sm p-5 flex-1">
            <h2 className="font-semibold text-gray-800 mb-3">Zone Detail</h2>
            {selected ? (
              <dl className="space-y-2 text-sm">
                <div><dt className="text-gray-500">ID</dt><dd className="font-medium text-gray-900">{selected.id}</dd></div>
                <div><dt className="text-gray-500">Name</dt><dd className="font-medium text-gray-900">{selected.name}</dd></div>
                <div><dt className="text-gray-500">Category</dt><dd className="font-medium text-gray-900">{CATEGORY_STYLE[selected.category].label}</dd></div>
                <div><dt className="text-gray-500">Area</dt><dd className="font-medium text-gray-900">{selected.area_ha} ha</dd></div>
                <div><dt className="text-gray-500">Centre</dt><dd className="font-mono text-xs text-gray-700">{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</dd></div>
              </dl>
            ) : (
              <p className="text-gray-400 text-sm">Click a zone on the map to see details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
