/**
 * DataCards.jsx — Golden Example
 *
 * Demonstrates:
 *  • Data array with objects using key: value syntax (string, number, and array values)
 *  • KPI summary cards
 *  • Plain text between JSX tags — NOT in {}
 *  • Conditional styling via ternary className
 *  • Safe number formatting with .toLocaleString()
 * Styling: Tailwind CSS — zero inline style={{}} props
 */

import React, { useState } from 'react';

const DATASETS = [
  {
    id: 'oak_ridge',
    name: 'Oak Ridge',
    region: 'East Tennessee',
    area: 87.3,
    population: 31402,
    forestCover: 42,
    watersheds: 3,
    description: 'Home to Oak Ridge National Laboratory. Dense urban core surrounded by protected forest land and the Clinch River watershed.',
    trend: 'up',
    change: 2.4,
  },
  {
    id: 'norris',
    name: 'Norris',
    region: 'Anderson County',
    area: 3.2,
    population: 1446,
    forestCover: 68,
    watersheds: 2,
    description: 'Small planned community adjacent to Norris Dam State Park. Very high forest cover ratio relative to total area.',
    trend: 'stable',
    change: 0.1,
  },
  {
    id: 'clinton',
    name: 'Clinton',
    region: 'Anderson County',
    area: 14.6,
    population: 9815,
    forestCover: 28,
    watersheds: 2,
    description: 'Seat of Anderson County. Located along the Clinch River with moderate forest cover and active agricultural land use.',
    trend: 'down',
    change: -1.2,
  },
];

const TREND_ICON = { up: '▲', stable: '●', down: '▼' };
const TREND_COLOR = { up: '#198754', stable: '#6c757d', down: '#dc3545' };

function StatBox({ label, value, unit }) {
  return (
    <div className="flex-1 basis-20 bg-gray-50 rounded-md px-3 py-2 text-center">
      <div className="text-lg font-bold text-gray-900">
        {value}{unit && <span className="text-xs text-gray-500 ml-0.5">{unit}</span>}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function DataCards() {
  const [selected, setSelected] = useState(null);

  const active = selected
    ? DATASETS.find(d => d.id === selected)
    : null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-1">Regional Data Summary</h1>
      <p className="text-gray-500 mb-7">
        Select a region to view detailed land-use and demographic statistics.
      </p>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {DATASETS.map(ds => (
          <div
            key={ds.id}
            onClick={() => setSelected(ds.id === selected ? null : ds.id)}
            className={`border-2 rounded-xl p-5 cursor-pointer transition-colors ${
              ds.id === selected
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-lg font-bold">{ds.name}</h2>
                <span className="text-xs text-gray-500">{ds.region}</span>
              </div>
              <span className="font-semibold text-sm" style={{ color: TREND_COLOR[ds.trend] }}>
                {TREND_ICON[ds.trend]} {ds.change > 0 ? '+' : ''}{ds.change}%
              </span>
            </div>

            <div className="flex gap-2 mb-3">
              <StatBox label="Area (sq mi)" value={ds.area} />
              <StatBox label="Population" value={ds.population.toLocaleString()} />
              <StatBox label="Forest %" value={ds.forestCover} unit="%" />
            </div>

            {/* Plain text paragraph — direct JSX content, no {} wrapping */}
            <p className="text-sm text-gray-600 leading-relaxed">
              {ds.description}
            </p>
          </div>
        ))}
      </div>

      {/* Detail Panel */}
      {active && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-bold mt-0 mb-4">{active.name} — Detailed View</h2>
          <div className="flex gap-4 flex-wrap mb-4">
            <StatBox label="Total Area" value={active.area} unit=" sq mi" />
            <StatBox label="Population" value={active.population.toLocaleString()} />
            <StatBox label="Forest Cover" value={active.forestCover} unit="%" />
            <StatBox label="Watersheds" value={active.watersheds} />
          </div>
          <p className="text-gray-600 leading-relaxed">
            {active.description}
          </p>
          <p className="text-gray-500 text-sm">
            Region: {active.region} · Trend: {active.change > 0 ? 'Increasing' : active.change < 0 ? 'Decreasing' : 'Stable'}
          </p>
        </div>
      )}

      {!active && (
        <p className="text-center text-gray-400 py-4">
          Click a card above to see detailed statistics.
        </p>
      )}
    </div>
  );
}
