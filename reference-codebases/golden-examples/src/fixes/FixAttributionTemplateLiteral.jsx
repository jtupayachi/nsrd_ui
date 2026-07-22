/**
 * FIX EXAMPLE: attribution prop — plain string containing HTML
 *
 * ERRORS THIS FIXES:
 *   "Expected identifier"
 *   "Unexpected token <"
 *   "Unterminated string constant"
 *   "Transform failed" near attribution=
 *   "Expected >" near attribution
 *
 * CAUSE: The attribution value contains an HTML <a> tag.
 *        Plain JS strings cannot contain "<" or ">" without escaping.
 *        JSX parses the "<a" as the start of a JSX element — causing a parse error.
 *
 * WRONG (causes build error):
 *   attribution="&copy; <a href="https://...">OpenStreetMap</a>"
 *   attribution='&copy; <a href="https://...">OpenStreetMap</a> contributors'
 *   attribution="© OpenStreetMap <a href='...'>contributors</a>"
 *
 * CORRECT — use a template literal (backticks) to hold HTML safely:
 *   attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`}
 *
 * RULE: Any prop value containing HTML tags or the characters < > MUST be a
 *       template literal wrapped in {`...`}, NOT a plain string "..." or '...'.
 */
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ✓ CORRECT — template literal with backticks:
export default function FixAttributionTemplateLiteral() {
  return (
    <MapContainer center={[35.93, -84.38]} zoom={10} style={{ height: '500px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
      />
    </MapContainer>
  );
}
