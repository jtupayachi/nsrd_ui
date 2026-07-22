/**
 * GOLDEN EXAMPLE — Runtime CSV fetch with PapaParse + loading / error states
 * Demonstrates: fetch("/data/X.csv"), PapaParse, loading spinner, error boundary,
 *               transformHeader for normalising messy column names, filter(NaN)
 * Styling: Tailwind CSS
 *
 * USE THIS PATTERN when the CSV is large or supplied as a project asset (not inline).
 * For small inline datasets, use the inline const CSV_DATA = `...` pattern instead.
 *
 * KEY RULES:
 *   1. fetch() MUST be inside useEffect — never in render body
 *   2. Always initialise data state as [] not null — prevents .map() crash
 *   3. Use transformHeader to normalise column names (trims spaces, lowercases)
 *   4. Always filter(d => !isNaN(d.lat) && !isNaN(d.lng)) after parse
 *   5. Show a loading spinner while fetching — prevents empty chart flash
 */
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export default function FetchCSVPage() {
  const [data, setData]       = useState([]);   // ← always [], never null
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    // fetch() MUST live inside useEffect — calling it in the render body
    // causes an infinite re-fetch loop that freezes the browser.
    fetch('/data/sensors.csv')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.url}`);
        return res.text();
      })
      .then(text => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          // transformHeader normalises column names:
          //   "Date (UTC)" → "date_utc"   " Lat_WGS84 " → "lat_wgs84"
          transformHeader: h =>
            h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, ''),
          complete: results => {
            const parsed = results.data
              .map((row, i) => ({
                id:    i,
                date:  row['date'],
                value: parseFloat(row['value']),
                temp:  parseFloat(row['temperature_c']),
                // Add more columns as needed — use the normalised header name
              }))
              // Drop rows where numeric fields are NaN (bad rows / header leakage)
              .filter(d => !isNaN(d.value));
            setData(parsed);
            setLoading(false);
          },
          error: err => {
            setError(err.message);
            setLoading(false);
          },
        });
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []); // ← empty deps = run once on mount

  // Loading state — always render this while data arrives
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading data…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-700 font-semibold mb-1">Failed to load data</p>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sensor Readings</h1>
        <p className="text-gray-500 text-sm mt-0.5">{data.length} records loaded from /data/sensors.csv</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Value Over Time</h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} strokeWidth={2} name="Value" />
            <Line type="monotone" dataKey="temp" stroke="#dc2626" dot={false} strokeWidth={2} name="Temp (°C)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
