/**
 * GOLDEN EXAMPLE — Recharts dashboard with CSV data
 * Demonstrates: BarChart, LineChart, PieChart, ResponsiveContainer, CSV parsing
 * This is a CORRECT, COMPILABLE reference. Follow this pattern exactly.
 * Styling: Tailwind CSS — zero inline style={{}} props
 */
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

const CSV_DATA = `month,sales,revenue,units
Jan,120,48000,95
Feb,145,58000,110
Mar,98,39200,80
Apr,162,64800,130
May,178,71200,145
Jun,201,80400,165`;

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      const v = vals[i]?.trim();
      obj[h.trim()] = isNaN(v) ? v : Number(v);
      return obj;
    }, {});
  });
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(parseCSV(CSV_DATA));
  }, []);

  const pieData = data.map(d => ({ name: d.month, value: d.sales }));

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Sales Dashboard</h2>

      {/* Bar chart — always wrap in ResponsiveContainer */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Monthly Sales</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="sales" fill="#0088FE" name="Sales" />
            <Bar dataKey="units" fill="#00C49F" name="Units" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Line chart */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Pie chart */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Sales Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {pieData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
