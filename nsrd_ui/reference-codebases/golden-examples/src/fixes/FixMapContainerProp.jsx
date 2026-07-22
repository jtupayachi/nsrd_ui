/**
 * FIX EXAMPLE: MapContainer style prop syntax error
 *
 * ERRORS THIS FIXES:
 *   "Expected >, got {"
 *   "Expected identifier"
 *   "Transform failed with 1 error"
 *   "Unexpected token, expected <MapContainer"
 *
 * CAUSE: The style object was written directly on the tag without the prop name.
 *
 * WRONG (causes build error):
 *   <MapContainer={{ height: "500px", width: "100%" }} center={[35.9, -84.4]} zoom={10}>
 *   <MapContainer{height:"500px"} center={[35.9,-84.4]} zoom={10}>
 *
 * CORRECT — "style" is a named JSX prop, written BEFORE the = sign:
 *   <MapContainer style={{ height: "500px", width: "100%" }} center={[35.9, -84.4]} zoom={10}>
 *
 * RULE: Every JSX prop follows the pattern:   propName={value}
 *       style={{ height: "500px" }}  ←  prop name "style", then ={...}
 */
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ✓ CORRECT pattern — always copy this exactly:
export default function FixMapContainerProp() {
  return (
    <MapContainer
      center={[35.93, -84.38]}
      zoom={10}
      style={{ height: '500px', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`}
      />
    </MapContainer>
  );
}
