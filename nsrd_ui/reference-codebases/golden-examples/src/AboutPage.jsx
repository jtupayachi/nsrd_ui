/**
 * GOLDEN EXAMPLE — Full-featured info/about page with rich layout
 * Demonstrates: info cards, section layout, external links, no data dependency
 * Styling: Tailwind CSS — zero inline style={{}} props
 */
import React from 'react';

const TEAM = [
  { name: 'Dr. Sarah Chen', role: 'Principal Investigator', area: 'Remote Sensing & GIS' },
  { name: 'Marcus Webb', role: 'Data Scientist', area: 'Machine Learning & Spatial Analysis' },
  { name: 'Priya Nair', role: 'Field Ecologist', area: 'Biodiversity & Land Cover' },
  { name: 'Tom Kowalski', role: 'Software Engineer', area: 'Visualization & Pipelines' },
];

const DATASETS = [
  { name: 'NLCD 2021', desc: 'National Land Cover Database', source: 'USGS', records: '30m raster, CONUS' },
  { name: 'NEON Sites', desc: 'National Ecological Observatory Network', source: 'NSF', records: '81 field sites' },
  { name: 'EPA WQP', desc: 'Water Quality Portal monitoring data', source: 'EPA/USGS', records: '400M+ results' },
  { name: 'MODIS NDVI', desc: 'Vegetation index time series', source: 'NASA', records: '500m, 16-day' },
];

function Card({ children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      {children}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">About NSRD</h1>
        <p className="text-gray-500 text-base mt-2 leading-relaxed">
          The Natural Resources Spatial Data (NSRD) platform integrates geospatial,
          ecological, and environmental monitoring data to support science-based land management
          decisions across the Oak Ridge Reservation and surrounding region.
        </p>
      </header>

      {/* Mission */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Mission</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: '🗺️', title: 'Spatial Integration', desc: 'Combine remote sensing, field data, and model outputs into coherent geospatial layers.' },
            { icon: '📊', title: 'Data Visualization', desc: 'Interactive dashboards revealing trends, anomalies, and correlations across datasets.' },
            { icon: '🤖', title: 'AI-Assisted Analysis', desc: 'LLM-powered app generation translates plain-language requirements into deployed tools.' },
            { icon: '🌿', title: 'Conservation Focus', desc: 'Support habitat assessment, species monitoring, and land cover change detection.' },
          ].map(item => (
            <Card key={item.title}>
              <div className="text-3xl mb-2">{item.icon}</div>
              <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Team</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEAM.map(t => (
            <Card key={t.name}>
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold mb-3">
                {t.name.split(' ').map(n => n[0]).join('')}
              </div>
              <strong className="text-sm">{t.name}</strong>
              <p className="text-blue-500 text-xs mt-0.5">{t.role}</p>
              <p className="text-gray-500 text-xs">{t.area}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Data sources */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Data Sources</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-200">
                <th className="px-4 py-3 text-left">Dataset</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {DATASETS.map((d, i) => (
                <tr key={d.name} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-2 font-semibold text-blue-600">{d.name}</td>
                  <td className="px-4 py-2 text-gray-900">{d.desc}</td>
                  <td className="px-4 py-2 text-gray-500">{d.source}</td>
                  <td className="px-4 py-2 text-gray-500">{d.records}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
