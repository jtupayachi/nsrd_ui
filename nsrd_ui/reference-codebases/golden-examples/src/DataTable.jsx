/**
 * GOLDEN EXAMPLE — Searchable sortable data table with CSV source
 * Demonstrates: useState filter/sort, table with headers, conditional styling
 * Styling: Tailwind CSS — zero inline style={{}} props
 */
import React, { useState, useEffect, useMemo } from 'react';

const CSV_DATA = `id,location,species,count,status,date
1,Grid A1,White-tailed Deer,12,Stable,2024-03-01
2,Grid A2,Wild Turkey,45,Increasing,2024-03-01
3,Grid B1,Black Bear,3,Stable,2024-03-02
4,Grid B2,Coyote,8,Increasing,2024-03-02
5,Grid C1,Bobcat,2,Declining,2024-03-03
6,Grid C2,River Otter,6,Stable,2024-03-03
7,Grid D1,Red Fox,14,Increasing,2024-03-04
8,Grid D2,Mink,4,Declining,2024-03-04
9,Grid E1,Raccoon,31,Stable,2024-03-05
10,Grid E2,Opossum,19,Stable,2024-03-05`;

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      const v = vals[i]?.trim();
      obj[h] = isNaN(v) || h === 'id' || h === 'date' ? v : Number(v);
      return obj;
    }, {});
  });
}

const STATUS_TAILWIND = {
  Stable:     'bg-green-100 text-green-700',
  Increasing: 'bg-blue-100 text-blue-700',
  Declining:  'bg-red-100 text-red-600',
};

export default function WildlifeTable() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('id');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    setData(parseCSV(CSV_DATA));
  }, []);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data
      .filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [data, search, sortKey, sortDir]);

  const headers = ['id', 'location', 'species', 'count', 'status', 'date'];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Wildlife Survey Data</h2>

      <input
        type="text"
        placeholder="Search species, location, status..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 mb-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-400"
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              {headers.map(h => (
                <th
                  key={h}
                  onClick={() => handleSort(h)}
                  className="px-4 py-3 text-left cursor-pointer select-none border-b-2 border-gray-200 whitespace-nowrap hover:bg-gray-200"
                >
                  {h.charAt(0).toUpperCase() + h.slice(1)}
                  {sortKey === h ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={row.id}
                className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                {headers.map(h => (
                  <td key={h} className="px-4 py-2 border-b border-gray-200">
                    {h === 'status' ? (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-xs ${STATUS_TAILWIND[row[h]] ?? ''}`}>
                        {row[h]}
                      </span>
                    ) : row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-8">No results found.</p>
        )}
      </div>
    </div>
  );
}
