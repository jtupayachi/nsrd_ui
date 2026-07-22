/**
 * TailwindHome.jsx — Golden Example
 *
 * Demonstrates Tailwind CSS for a project landing / home page:
 *  • Hero section with gradient background
 *  • Responsive card grid
 *  • Stat KPI bar
 *  • Tailwind utility classes for ALL layout and styling
 *  • NO inline style={{ }} props anywhere
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const CARDS = [
  {
    id: 'map',
    icon: '🗺️',
    title: 'Interactive Map',
    desc: 'Explore Oak Ridge sample sites, monitoring stations, and watershed boundaries on an interactive Leaflet map.',
    link: '/map',
    color: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    badgeLabel: 'GIS',
  },
  {
    id: 'data',
    icon: '📊',
    title: 'Data Dashboard',
    desc: 'Bar charts, line charts, and pie charts visualizing collected environmental and ecological data over time.',
    link: '/dashboard',
    color: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    badgeLabel: 'Charts',
  },
  {
    id: 'table',
    icon: '📋',
    title: 'Data Table',
    desc: 'Browse, search, and sort the full dataset. Download filtered results as CSV.',
    link: '/table',
    color: 'bg-purple-50 border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    badgeLabel: 'Table',
  },
  {
    id: 'about',
    icon: '🏛️',
    title: 'About the Project',
    desc: 'Background on the research program, funding sources, and the ORNL teams involved.',
    link: '/about',
    color: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    badgeLabel: 'Info',
  },
];

const STATS = [
  { label: 'Sample Sites', value: '247' },
  { label: 'Data Points', value: '18,400' },
  { label: 'Years of Data', value: '12' },
  { label: 'Species Tracked', value: '89' },
];

export default function TailwindHome() {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ─────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
            Oak Ridge National Laboratory
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
            Natural Systems<br />Research Dashboard
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl leading-relaxed mb-8">
            Explore spatial data, ecological monitoring results, and environmental trends
            collected across the Oak Ridge Reservation and surrounding watersheds.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/map"
              className="bg-white text-blue-700 font-semibold px-5 py-2.5 rounded-lg shadow hover:bg-blue-50 transition-colors"
            >
              Open Map →
            </Link>
            <Link
              to="/dashboard"
              className="border border-white/60 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              View Charts
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────── */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-2xl font-extrabold text-blue-600">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Card grid ─────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Explore the Data</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CARDS.map(card => (
            <Link
              key={card.id}
              to={card.link}
              className={`block border rounded-xl p-6 transition-all hover:shadow-md hover:-translate-y-0.5 ${card.color} ${hovered === card.id ? 'shadow-md' : ''}`}
              onMouseEnter={() => setHovered(card.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{card.icon}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${card.badge}`}>
                  {card.badgeLabel}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">{card.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{card.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
        Oak Ridge National Laboratory · Natural Systems Research Division ·{' '}
        <a href="https://www.ornl.gov" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          ornl.gov
        </a>
      </footer>
    </div>
  );
}
