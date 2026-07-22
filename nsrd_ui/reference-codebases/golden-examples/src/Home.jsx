/**
 * GOLDEN EXAMPLE — React home page with navigation links
 * Demonstrates: clean home component, Link from react-router-dom, card grid layout
 * This is a CORRECT, COMPILABLE reference. Follow this pattern exactly.
 * Styling: Tailwind CSS — zero inline style={{}} props
 */
import React from 'react';
import { Link } from 'react-router-dom';

const PAGES = [
  { to: '/data', title: 'Data Visualization', desc: 'Charts and graphs from sensor data' },
  { to: '/map', title: 'Map View', desc: 'Interactive geospatial visualization' },
  { to: '/analysis', title: 'Analysis', desc: 'Statistical summaries and trends' },
];

export default function Home() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          NSRD Dashboard
        </h1>
        <p className="text-gray-500 text-lg mt-2">
          Natural Resources Spatial Data Explorer
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PAGES.map((pg) => (
          <Link
            key={pg.to}
            to={pg.to}
            className="no-underline"
          >
            <div className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:shadow-md transition-shadow">
              <h3 className="text-blue-500 font-semibold mb-1">{pg.title}</h3>
              <p className="text-gray-500 text-sm">{pg.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
