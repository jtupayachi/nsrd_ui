/**
 * FIX EXAMPLE: import statement split across multiple lines
 *
 * ERRORS THIS FIXES:
 *   "Unterminated string constant"
 *   "Expected ; but found string"
 *   "Cannot find module"  (when the path wraps to next line)
 *   "Unexpected token from"
 *   "Expected identifier, got 'from'"
 *
 * CAUSE: An import statement was broken across two lines.
 *        The string parser sees a newline inside the quote and reports "unterminated string".
 *
 * WRONG (causes build error):
 *   import { MapContainer, TileLayer, Marker,
 *     Popup, CircleMarker } from 'react-leaflet';
 *
 *   import { LineChart, Line, XAxis, YAxis,
 *            CartesianGrid, Tooltip } from
 *   'recharts';
 *
 *   import React
 *   from 'react';
 *
 * CORRECT — every import is ONE complete line:
 *   import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
 *   import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
 *   import React from 'react';
 *
 * RULE: The entire import statement — "import", named imports, "from", and the
 *       module path — MUST be on a single line with no line breaks.
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';

// ✓ All imports above are on ONE line each — this is always correct.
export default function FixSplitImport() {
  const [data] = useState([
    { month: 'Jan', value: 40 },
    { month: 'Feb', value: 55 },
    { month: 'Mar', value: 48 },
  ]);

  return (
    <div className="p-6">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
