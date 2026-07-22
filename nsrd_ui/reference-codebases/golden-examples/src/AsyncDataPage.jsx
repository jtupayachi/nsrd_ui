/**
 * GOLDEN EXAMPLE — useEffect data fetching pattern + loading/error states
 * Demonstrates: async/await in useEffect, loading spinner, error boundary pattern,
 *               conditional rendering, skeleton placeholder
 * Styling: Tailwind CSS — animate-spin for spinner, zero inline style={{}} props
 */
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Simulated async data load (replace with real fetch() if needed)
async function loadData() {
  return new Promise(resolve =>
    setTimeout(() => resolve([
      { category: 'Oak', count: 342, pct: 28 },
      { category: 'Maple', count: 218, pct: 18 },
      { category: 'Pine', count: 195, pct: 16 },
      { category: 'Hickory', count: 167, pct: 14 },
      { category: 'Birch', count: 132, pct: 11 },
      { category: 'Other', count: 158, pct: 13 },
    ]), 600)
  );
}

function Spinner() {
  return (
    <div className="flex justify-center items-center h-48">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-400 rounded-lg p-5 text-center">
      <p className="text-red-500 font-semibold">Failed to load data</p>
      <p className="text-gray-500 text-sm mt-1">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 px-5 py-1.5 rounded-lg bg-red-500 text-white cursor-pointer border-0 text-sm"
      >
        Retry
      </button>
    </div>
  );
}

export default function TreeInventory() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await loadData();
      setData(result);
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-1">Tree Inventory</h2>
      <p className="text-gray-500 mb-6">Species composition across monitored plots</p>

      {loading && <Spinner />}
      {error && <ErrorMessage message={error} onRetry={fetchData} />}
      {!loading && !error && (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(v, name) => [v, name === 'count' ? 'Trees' : '%']} />
              <Bar dataKey="count" fill="#34c759" name="count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="flex flex-wrap gap-3 mt-6">
            {data.map(d => (
              <div key={d.category} className="bg-gray-100 rounded-xl px-5 py-3 min-w-[110px]">
                <p className="text-xl font-bold text-green-500">{d.pct}%</p>
                <p className="text-sm text-gray-900">{d.category}</p>
                <p className="text-xs text-gray-500">{d.count} trees</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
