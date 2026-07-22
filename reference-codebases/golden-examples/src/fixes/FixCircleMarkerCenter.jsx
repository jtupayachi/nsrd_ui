/**
 * FIX EXAMPLE: CircleMarker uses center={}, NOT position={}
 *
 * RUNTIME ERROR THIS FIXES:
 *   "TypeError: undefined is not an object (evaluating 'o.lat')"
 *   White screen after brief flash — app renders then crashes
 *
 * CAUSE: Confusing <Marker> with <CircleMarker>.
 *   <Marker>       uses   position={[lat, lng]}   ← Marker prop
 *   <CircleMarker> uses   center={[lat, lng]}     ← CircleMarker prop
 *
 * WRONG — crashes at runtime (o.lat is undefined):
 *   <CircleMarker position={[site.lat, site.lng]} radius={8} />
 *
 * CORRECT — center is the right prop for CircleMarker:
 *   <CircleMarker center={[site.lat, site.lng]} radius={8} />
 *
 * RULE: NEVER use position= on CircleMarker. NEVER use center= on Marker.
 *
 * Summary:
 *   Component       | Correct prop         | Wrong prop (crashes)
 *   --------------- | -------------------- | --------------------
 *   <Marker>        | position={[lat,lng]} | center= (ignored)
 *   <CircleMarker>  | center={[lat,lng]}   | position= (crashes)
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const SITES = [
  { id: 1, name: 'Site A', lat: 35.930, lng: -84.380, value: 42 },
  { id: 2, name: 'Site B', lat: 35.945, lng: -84.355, value: 18 },
  { id: 3, name: 'Site C', lat: 35.915, lng: -84.405, value: 73 },
];

// ✓ CORRECT: CircleMarker uses center={[lat, lng]}
export default function FixCircleMarkerCenter() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">CircleMarker vs Marker — Correct Props</h2>
      <MapContainer
        center={[35.93, -84.38]}
        zoom={12}
        style={{ height: '480px', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
        />

        {/* CircleMarker — MUST use center={[lat,lng]}, NOT position= */}
        {SITES.map(site => (
          <CircleMarker
            key={site.id}
            center={[site.lat, site.lng]}
            radius={10}
            pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.7 }}
          >
            <Popup><strong>{site.name}</strong><br />Value: {site.value}</Popup>
          </CircleMarker>
        ))}

        {/* Marker — MUST use position={[lat,lng]}, NOT center= */}
        <Marker position={[35.95, -84.37]}>
          <Popup>Regular Marker — uses position=</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
