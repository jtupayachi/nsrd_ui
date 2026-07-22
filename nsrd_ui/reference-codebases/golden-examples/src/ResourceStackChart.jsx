/**
 * GOLDEN EXAMPLE — Recharts stacked bar + area chart for resource data
 * Demonstrates: StackedBar, AreaChart, Area, XAxis with angle labels
 * Styling: Tailwind CSS — zero inline style={{}} props
 */
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';

const RESOURCE_CSV = `year,forest_ha,wetland_ha,grassland_ha,developed_ha
2015,12450,3200,5600,1800
2016,12380,3150,5550,1900
2017,12310,3090,5480,2010
2018,12240,3020,5400,2130
2019,12180,2950,5310,2260
2020,12100,2870,5210,2400
2021,12030,2790,5090,2550
2022,11960,2700,4960,2710`;

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

const COLORS = {
  forest_ha: '#34c759',
  wetland_ha: '#007aff',
  grassland_ha: '#ff9f0a',
  developed_ha: '#ff3b30',
};

const LABELS = {
  forest_ha: 'Forest (ha)',
  wetland_ha: 'Wetland (ha)',
  grassland_ha: 'Grassland (ha)',
  developed_ha: 'Developed (ha)',
};

export default function ResourceStackChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(parseCSV(RESOURCE_CSV));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Land Cover Trends (2015–2022)</h2>

      <section className="mb-10">
        <h3 className="text-lg font-semibold mb-2">Stacked Land Cover by Year</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => `${v.toLocaleString()} ha`} />
            <Legend formatter={k => LABELS[k]} />
            <Bar dataKey="forest_ha" stackId="a" fill={COLORS.forest_ha} />
            <Bar dataKey="wetland_ha" stackId="a" fill={COLORS.wetland_ha} />
            <Bar dataKey="grassland_ha" stackId="a" fill={COLORS.grassland_ha} />
            <Bar dataKey="developed_ha" stackId="a" fill={COLORS.developed_ha} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-2">Developed Land Growth (Area Chart)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
            <defs>
              <linearGradient id="devGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff3b30" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ff3b30" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={v => `${v.toLocaleString()} ha`} />
            <Area type="monotone" dataKey="developed_ha" stroke="#ff3b30" fill="url(#devGrad)" name="Developed (ha)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
