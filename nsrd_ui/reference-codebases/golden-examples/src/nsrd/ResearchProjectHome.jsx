/**
 * GOLDEN EXAMPLE — Research project homepage / welcome page
 *
 * MATCHES USER INPUTS LIKE:
 *   "create a base welcome homepage for a research project"
 *   "homepage with main feature icons and navigation"
 *   "landing page with 4 or 5 icons linking to sections"
 *   "project home page with icon grid and description"
 *   "welcome page environmental monitoring project"
 *   "home page with cards linking to map, data, about"
 *   "portal entry page with hero section and feature grid"
 *
 * SVG LAYOUT REGIONS THIS HANDLES:
 *   hero, header, title, subtitle, banner
 *   card-grid, icon-grid, feature-cards, nav-cards
 *   about, mission, description, footer
 *   sidebar (ignored on home — full width layout)
 *
 * CSV: no CSV expected on a homepage
 *
 * DEMONSTRATES:
 *   - Hero section with project title + subtitle
 *   - Icon card grid (4–6 cards) each linking to another page via React Router Link
 *   - "About" / mission statement section
 *   - Fully Tailwind, zero inline styles
 */
import React from 'react';
import { Link } from 'react-router-dom';

const FEATURE_CARDS = [
  {
    icon: '🗺️',
    title: 'Interactive Map',
    description: 'Explore monitoring sites and sensor tower locations across the study area.',
    to: '/map',
  },
  {
    icon: '📈',
    title: 'Data Explorer',
    description: 'Browse multi-year time series measurements from field instruments.',
    to: '/data',
  },
  {
    icon: '📊',
    title: 'Dashboard',
    description: 'Summary statistics, trend charts, and key performance indicators.',
    to: '/dashboard',
  },
  {
    icon: '🌿',
    title: 'Ecology',
    description: 'Species richness, habitat classification, and biodiversity indices.',
    to: '/ecology',
  },
  {
    icon: '📋',
    title: 'Reports',
    description: 'Annual summaries, data quality reports, and publication references.',
    to: '/reports',
  },
  {
    icon: 'ℹ️',
    title: 'About',
    description: 'Project background, partner institutions, and contact information.',
    to: '/about',
  },
];

export default function ResearchProjectHome() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <header className="bg-gradient-to-r from-green-700 to-teal-600 text-white py-16 px-6 text-center">
        <h1 className="text-4xl font-bold mb-3">Environmental Monitoring Portal</h1>
        <p className="text-lg text-green-100 max-w-2xl mx-auto">
          Integrated data access for long-term ecological and environmental research.
          Explore field measurements, geospatial data, and multi-year trends.
        </p>
      </header>

      {/* Feature icon card grid */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-8 text-center">Explore the Portal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_CARDS.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-start hover:shadow-md hover:border-green-300 transition-all group"
            >
              <span className="text-4xl mb-3">{card.icon}</span>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-700 mb-1">
                {card.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{card.description}</p>
            </Link>
          ))}
        </div>
      </main>

      {/* Mission / About strip */}
      <section className="bg-white border-t border-gray-200 py-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">About This Project</h2>
          <p className="text-gray-600 leading-relaxed">
            This portal provides open access to environmental monitoring data collected across
            a managed study area. Data span multiple decades and include meteorological,
            hydrological, and ecological measurements from a network of field instruments.
          </p>
        </div>
      </section>
    </div>
  );
}
