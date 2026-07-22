/**
 * GOLDEN EXAMPLE — KPI summary dashboard with sortable/filterable data table + bar chart
 *
 * MATCHES USER INPUTS LIKE:
 *   "data table with summary statistics"
 *   "KPI cards and sortable table"
 *   "tabular data with summary charts"
 *   "show all records in a table with stats summary"
 *   "filterable table with bar chart overview"
 *   "inventory or catalog data with summary stats"
 *   "many rows many columns table with chart summary"
 *   "field data table with totals and averages"
 *   "species count data, table with bar chart"
 *   "data with categories and numeric values, dashboard"
 *
 * USE THIS TEMPLATE WHEN:
 *   - Data is primarily tabular (no lat/lng, no time series)
 *   - Multiple categorical + numeric columns
 *   - User wants to explore, sort, filter records
 *   - Bar chart summarizing by category is the main visualization
 *   - Could be species counts, plot measurements, experiment results
 *
 * CSV COLUMNS THIS HANDLES:
 *   Any text/categorical column → filter dropdown + group-by option
 *   Any numeric column          → KPI stat + bar chart + table column
 *
 * DEMONSTRATES:
 *   - KPI cards with min/max/avg/count
 *   - Horizontal bar chart grouped by category
 *   - Sortable table (click column header)
 *   - Text search filter + category dropdown filter
 *   - Pagination (10 rows per page)
 *   - Column highlighting when sorted
 */
import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const DATA_CSV = `plot_id,ecosystem_type,species_richness,tree_density_ha,basal_area_m2ha,canopy_cover_pct,understory_pct,notes
P001,Mixed Hardwood,42,385,28.4,85,55,Dominated by oak and maple
P002,Pine Plantation,18,612,31.2,90,20,Loblolly pine monoculture
P003,Riparian Forest,56,290,24.7,78,68,High biodiversity near stream
P004,Mixed Hardwood,38,410,26.9,82,50,Hickory co-dominant
P005,Oak Savanna,29,180,15.3,45,72,Fire-maintained open canopy
P006,Pine Plantation,22,580,29.8,88,18,Virginia pine dominant
P007,Riparian Forest,61,265,22.1,75,74,Sycamore and tulip poplar
P008,Mixed Hardwood,45,395,30.1,87,52,Mature second-growth stand
P009,Oak Savanna,24,165,12.8,40,78,Encroaching shrubs present
P010,Riparian Forest,58,275,23.5,77,71,Flood scour visible
P011,Mixed Hardwood,40,420,27.6,84,48,High deer browse pressure
P012,Pine Plantation,20,595,30.5,91,15,Recently thinned
P013,Mixed Hardwood,36,375,25.8,80,58,Edge habitat, fragmented
P014,Oak Savanna,31,190,14.1,42,70,Native grass understory
P015,Riparian Forest,53,285,21.9,74,66,Beaver activity nearby`;

function parseCSV(csv) {
  const [header, ...rows] = csv.trim().split('\n');
  const keys = header.split(',').map(k => k.trim());
  return rows.map(row => {
    const vals = row.split(',');
    return keys.reduce((obj, k, i) => {
      const v = vals[i]?.trim();
      obj[k] = isNaN(v) ? v : Number(v);
      return obj;
    }, {});
  });
}

const NUM_COLS = [
  { key: 'species_richness',    label: 'Species Richness',    unit: ''     },
  { key: 'tree_density_ha',     label: 'Tree Density',        unit: '/ha'  },
  { key: 'basal_area_m2ha',     label: 'Basal Area',          unit: 'm²/ha'},
  { key: 'canopy_cover_pct',    label: 'Canopy Cover',        unit: '%'    },
  { key: 'understory_pct',      label: 'Understory',          unit: '%'    },
];

const PAGE_SIZE = 6;
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function KpiTableDashboard() {
  const allData = useMemo(() => parseCSV(DATA_CSV), []);

  const [metric, setMetric]     = useState(NUM_COLS[0].key);
  const [search, setSearch]     = useState('');
  const [ecoFilter, setEcoFilter] = useState('All');
  const [sortCol, setSortCol]   = useState(NUM_COLS[0].key);
  const [sortDir, setSortDir]   = useState('desc');  // 'asc' | 'desc'
  const [page, setPage]         = useState(0);

  const activeMeta = NUM_COLS.find(c => c.key === metric) || NUM_COLS[0];
  const ecosystems = useMemo(() => ['All', ...new Set(allData.map(r => r.ecosystem_type))], [allData]);

  // Filter
  const filtered = useMemo(() => allData.filter(r => {
    const matchEco    = ecoFilter === 'All' || r.ecosystem_type === ecoFilter;
    const matchSearch = !search || Object.values(r).some(v =>
      String(v).toLowerCase().includes(search.toLowerCase()));
    return matchEco && matchSearch;
  }), [allData, ecoFilter, search]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  function handleSort(col) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setPage(0);
  }

  const pageData  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  // KPI stats for active metric
  const vals   = filtered.map(r => r[metric]).filter(v => v != null);
  const minV   = vals.length ? Math.min(...vals) : 0;
  const maxV   = vals.length ? Math.max(...vals) : 0;
  const avgV   = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : 0;
  const totalV = vals.length ? vals.reduce((s, v) => s + v, 0).toFixed(0) : 0;

  // Bar chart: average metric by ecosystem type
  const byEco = useMemo(() => {
    const groups = {};
    filtered.forEach(r => {
      if (!groups[r.ecosystem_type]) groups[r.ecosystem_type] = [];
      groups[r.ecosystem_type].push(r[metric]);
    });
    return Object.entries(groups).map(([type, values]) => ({
      name: type.split(' ').map(w => w[0]).join(''), // abbreviate
      fullName: type,
      avg: (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1),
    }));
  }, [filtered, metric]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Forest Plot Data Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {filtered.length} plots · {ecosystems.length - 1} ecosystem types
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Count',   value: filtered.length, unit: 'plots',       color: 'blue'   },
          { label: 'Min',     value: minV,             unit: activeMeta.unit, color: 'emerald'},
          { label: 'Max',     value: maxV,             unit: activeMeta.unit, color: 'red'    },
          { label: 'Average', value: avgV,             unit: activeMeta.unit, color: 'amber'  },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 border-${color}-500`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{value} {unit}</p>
            <p className="text-xs text-gray-400 mt-0.5">{activeMeta.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Metric selector + bar chart */}
        <div className="bg-white rounded-2xl shadow-sm p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Average by Ecosystem</h2>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
            >
              {NUM_COLS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byEco} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val, _, p) => [`${val} ${activeMeta.unit}`, p.payload.fullName]}
                labelFormatter={() => ''}
              />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]} name={activeMeta.label}>
                {byEco.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {byEco.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {entry.fullName}
              </div>
            ))}
          </div>
        </div>

        {/* Filters panel */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Filters</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search plots or notes..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white placeholder-gray-300 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Ecosystem Type</label>
              <div className="flex flex-col gap-1.5">
                {ecosystems.map(eco => (
                  <button
                    key={eco}
                    onClick={() => { setEcoFilter(eco); setPage(0); }}
                    className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      ecoFilter === eco
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {eco} {eco !== 'All' && `(${allData.filter(r => r.ecosystem_type === eco).length})`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data table with sort */}
      <div className="bg-white rounded-2xl shadow-sm p-5 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Plot Records</h2>
          <p className="text-xs text-gray-400">{sorted.length} results</p>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
              <th
                className="py-2 pr-4 cursor-pointer hover:text-gray-700 select-none"
                onClick={() => handleSort('plot_id')}
              >
                Plot {sortCol === 'plot_id' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th
                className="py-2 pr-4 cursor-pointer hover:text-gray-700 select-none"
                onClick={() => handleSort('ecosystem_type')}
              >
                Ecosystem {sortCol === 'ecosystem_type' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              {NUM_COLS.map(col => (
                <th
                  key={col.key}
                  className={`py-2 pr-4 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap ${
                    sortCol === col.key ? 'text-blue-600 font-bold' : ''
                  }`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label} {col.unit && <span className="font-normal">({col.unit})</span>}
                  {' '}{sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map(row => (
              <tr key={row.plot_id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 pr-4 font-semibold text-gray-800">{row.plot_id}</td>
                <td className="py-2 pr-4 text-gray-600">{row.ecosystem_type}</td>
                {NUM_COLS.map(col => (
                  <td key={col.key}
                    className={`py-2 pr-4 ${sortCol === col.key ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}>
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded-lg text-xs border border-gray-200 disabled:opacity-30 hover:border-gray-400"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded-lg text-xs border border-gray-200 disabled:opacity-30 hover:border-gray-400"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
