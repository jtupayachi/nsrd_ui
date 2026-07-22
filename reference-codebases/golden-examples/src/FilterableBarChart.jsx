/**
 * GOLDEN EXAMPLE — Filterable Recharts bar chart with category selector
 * Demonstrates: useState filters, dynamic data slicing, ComposedChart, Bar+Line overlay
 * Styling: Tailwind CSS — zero inline style={{}} props
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const CSV_DATA = `region,q1_visits,q2_visits,q3_visits,q4_visits,annual_goal
Northeast,1240,1560,1820,1100,6000
Southeast,2100,2340,2890,1980,9000
Midwest,890,1020,1340,760,4500
Southwest,1580,1790,2100,1350,7200
Northwest,670,820,1050,590,3500
California,3200,3600,4100,2800,13000`;

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

const QUARTERS = ['q1_visits', 'q2_visits', 'q3_visits', 'q4_visits'];
const Q_LABELS = { q1_visits: 'Q1', q2_visits: 'Q2', q3_visits: 'Q3', q4_visits: 'Q4' };
const Q_COLORS = { q1_visits: '#007aff', q2_visits: '#34c759', q3_visits: '#ff9f0a', q4_visits: '#af52de' };

export default function RegionVisitsChart() {
  const [data, setData] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState(new Set());
  const [activeQuarters, setActiveQuarters] = useState(new Set(QUARTERS));

  useEffect(() => {
    const parsed = parseCSV(CSV_DATA);
    setData(parsed);
    setSelectedRegions(new Set(parsed.map(d => d.region)));
  }, []);

  function toggleRegion(region) {
    setSelectedRegions(prev => {
      const next = new Set(prev);
      next.has(region) ? next.delete(region) : next.add(region);
      return next;
    });
  }

  function toggleQuarter(q) {
    setActiveQuarters(prev => {
      const next = new Set(prev);
      next.has(q) ? next.delete(q) : next.add(q);
      return next;
    });
  }

  const chartData = useMemo(() => {
    return data
      .filter(d => selectedRegions.has(d.region))
      .map(d => {
        const row = { region: d.region, annual_goal: d.annual_goal };
        QUARTERS.forEach(q => { row[q] = d[q]; });
        return row;
      });
  }, [data, selectedRegions]);

  const allRegions = data.map(d => d.region);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Regional Visitor Statistics</h2>

      {/* Region toggles */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-1">Filter regions:</p>
        <div className="flex flex-wrap gap-2">
          {allRegions.map(r => (
            <button
              key={r}
              onClick={() => toggleRegion(r)}
              className={`px-3 py-1 rounded-2xl border text-xs cursor-pointer transition-colors ${
                selectedRegions.has(r)
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-100 text-gray-900 border-gray-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Quarter toggles — keep border color from Q_COLORS map */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 mb-1">Show quarters:</p>
        <div className="flex gap-2">
          {QUARTERS.map(q => (
            <button
              key={q}
              onClick={() => toggleQuarter(q)}
              className="px-3 py-1 rounded-2xl text-xs cursor-pointer transition-colors"
              style={{
                border: `1px solid ${Q_COLORS[q]}`,
                background: activeQuarters.has(q) ? Q_COLORS[q] : '#fff',
                color: activeQuarters.has(q) ? '#fff' : Q_COLORS[q],
              }}
            >
              {Q_LABELS[q]}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="region" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          {QUARTERS.filter(q => activeQuarters.has(q)).map(q => (
            <Bar key={q} dataKey={q} name={Q_LABELS[q]} fill={Q_COLORS[q]} stackId="visits" />
          ))}
          <Line type="monotone" dataKey="annual_goal" name="Annual Goal" stroke="#ff3b30" strokeDasharray="6 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
