/**
 * HistoryTimeline.jsx — Golden Example
 *
 * Demonstrates:
 *  • Data arrays with objects that have year/title/description keys — all with ":"
 *  • Plain text rendered DIRECTLY between JSX tags (no {} wrapping)
 *  • {variable} used only for actual JS expressions
 *  • Section/article/p layout with className styling
 *  • Conditional rendering with array .map()
 * Styling: Tailwind CSS — dot color kept as inline style (runtime computed value)
 */

import React, { useState } from 'react';

const milestones = [
  {
    year: '1960s',
    title: 'Origins of GIS',
    description: 'The first geographic information systems emerged from academia and government agencies. Roger Tomlinson developed the Canada Geographic Information System to manage natural resource data.',
    category: 'foundation',
  },
  {
    year: '1970s',
    title: 'Modern GIS Emerges',
    description: 'The field of GIS matured with the introduction of comprehensive software platforms and standardized data formats. ESRI was founded in 1969 and released early GIS products.',
    category: 'growth',
  },
  {
    year: '1980s',
    title: 'Commercial Adoption',
    description: 'Commercial GIS software became available to municipalities and businesses. Arc/Info became an industry standard for managing large spatial datasets.',
    category: 'growth',
  },
  {
    year: '1990s',
    title: 'Desktop GIS Revolution',
    description: 'Personal computers enabled desktop GIS tools. ArcView brought GIS to a much wider audience. The internet began enabling map sharing and collaborative spatial analysis.',
    category: 'expansion',
  },
  {
    year: '2000s',
    title: 'Web Mapping Takes Off',
    description: 'Google Maps launched in 2005, transforming public expectations of interactive maps. OpenStreetMap was founded the same year, pioneering crowd-sourced geographic data.',
    category: 'web',
  },
  {
    year: '2010s',
    title: 'Mobile and Cloud GIS',
    description: 'Smartphones placed GPS-enabled mapping in every pocket. Cloud platforms enabled processing of massive geospatial datasets. Open-source tools like QGIS and Leaflet gained widespread adoption.',
    category: 'web',
  },
  {
    year: '2020s',
    title: 'AI-Enhanced Geospatial Analysis',
    description: 'Machine learning accelerated change detection, land cover classification, and predictive modeling. Real-time data streams from IoT sensors enriched spatial analysis pipelines.',
    category: 'ai',
  },
];

const CATEGORY_COLORS = {
  foundation: '#6c757d',
  growth: '#0d6efd',
  expansion: '#198754',
  web: '#fd7e14',
  ai: '#6f42c1',
};

export default function HistoryTimeline() {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = ['all', ...new Set(milestones.map(m => m.category))];

  const filtered = activeCategory === 'all'
    ? milestones
    : milestones.filter(m => m.category === activeCategory);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">History of GIS</h1>
      <p className="text-gray-500 mb-6">
        From early academic research to AI-enhanced analysis, the evolution of geographic information systems.
      </p>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full border text-sm cursor-pointer capitalize transition-colors ${
              activeCategory === cat
                ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                : 'bg-white text-gray-900 border-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative pl-8">
        {/* Vertical line */}
        <div className="absolute left-[10px] top-0 bottom-0 w-0.5 bg-gray-200" />

        {filtered.map((milestone, index) => (
          <article key={index} className="relative mb-8">
            {/* Dot — color from runtime CATEGORY_COLORS map */}
            <div
              className="absolute -left-[26px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_0_2px_#dee2e6]"
              style={{ background: CATEGORY_COLORS[milestone.category] || '#6c757d' }}
            />

            {/* Content */}
            <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 shadow-sm">
              <div className="flex items-baseline gap-3 mb-1">
                <span
                  className="font-bold text-base"
                  style={{ color: CATEGORY_COLORS[milestone.category] || '#6c757d' }}
                >
                  {milestone.year}
                </span>
                <h2 className="text-lg font-semibold m-0">
                  {milestone.title}
                </h2>
              </div>
              {/* Plain text paragraph — NOT wrapped in {} */}
              <p className="m-0 text-gray-600 leading-relaxed">
                {milestone.description}
              </p>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 py-10">
          No milestones found for this category.
        </p>
      )}

      <footer className="mt-10 pt-4 border-t border-gray-200 text-gray-500 text-sm">
        Data compiled from ESRI, OpenStreetMap Foundation, and USGS historical records.
      </footer>
    </div>
  );
}
