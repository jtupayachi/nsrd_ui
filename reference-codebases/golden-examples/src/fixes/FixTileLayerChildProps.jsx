/**
 * FIX EXAMPLE: TileLayer props written as JSX children instead of attributes
 *
 * ERRORS THIS FIXES:
 *   "Expected />, got url"
 *   "Expected >, got ="
 *   "Unexpected token url"
 *   "url is not defined"
 *   "attribution is not defined"
 *
 * CAUSE: Props were placed AFTER the closing ">" as if they were children text,
 *        instead of BEFORE the "/>".
 *
 * WRONG (causes build error):
 *   <TileLayer>
 *     url="https://..."
 *     attribution={`...`}
 *   </TileLayer>
 *
 *   <TileLayer>
 *     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 *   </TileLayer>
 *
 * CORRECT — ALL props go INSIDE the opening tag before the />:
 *   <TileLayer
 *     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 *     attribution={`&copy; <a href="...">OpenStreetMap</a>`}
 *   />
 *
 * RULE: Self-closing tags (<TileLayer />) have NO children.
 *       Props live between the tag name and the "/>" — never after ">".
 */
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ✓ CORRECT pattern:
export default function FixTileLayerChildProps() {
  return (
    <MapContainer center={[35.93, -84.38]} zoom={10} style={{ height: '500px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`}
      />
    </MapContainer>
  );
}
