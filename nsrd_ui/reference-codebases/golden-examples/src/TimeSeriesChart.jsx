/**
 * GOLDEN EXAMPLE — Recharts multi-series line chart with time series data
 * Demonstrates: LineChart, multiple Lines, custom Tooltip, date formatting
 * Styling: Tailwind CSS — zero inline style={{}} props
 */
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

const CSV_DATA = `date,temp_c,humidity,wind_ms
2024-01-01,2.1,85,3.2
2024-01-02,3.5,78,4.1
2024-01-03,1.8,90,2.8
2024-01-04,5.2,72,5.6
2024-01-05,6.1,68,6.3
2024-01-06,4.3,75,4.8
2024-01-07,7.8,63,7.1
2024-01-08,9.2,60,5.9
2024-01-09,8.5,65,6.7
2024-01-10,6.0,71,5.2`;

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      const v = vals[i]?.trim();
      obj[h] = isNaN(v) ? v : Number(v);
      return obj;
    }, {});
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
        <p className="font-bold mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm my-0.5" style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TimeSeriesChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(parseCSV(CSV_DATA));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-1">Environmental Time Series</h2>
      <p className="text-gray-500 mb-6">Daily measurements — Jan 2024</p>

      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Temperature & Humidity</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="temp" orientation="left" domain={[0, 15]} />
            <YAxis yAxisId="hum" orientation="right" domain={[50, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <ReferenceLine yAxisId="temp" y={5} stroke="#ff9f0a" strokeDasharray="4 4" label="5°C" />
            <Line yAxisId="temp" type="monotone" dataKey="temp_c" stroke="#ff3b30" name="Temp (°C)" dot={false} strokeWidth={2} />
            <Line yAxisId="hum" type="monotone" dataKey="humidity" stroke="#007aff" name="Humidity (%)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-2">Wind Speed</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="wind_ms" stroke="#34c759" name="Wind (m/s)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
