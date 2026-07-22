/**
 * FIX EXAMPLE: Inline style={} instead of Tailwind className
 *
 * ERRORS THIS FIXES (and style issues this corrects):
 *   "Do not use inline style" (linter)
 *   Build succeeds but layout looks broken
 *   Components unstyled / missing colours
 *   Tailwind classes not applying
 *
 * CAUSE: Generated code used style={{ }} objects instead of Tailwind className.
 *        The app-wide src/index.css already loads Tailwind — className works everywhere.
 *
 * WRONG (style={{}} breaks Tailwind-only setup):
 *   <div style={{ display: 'flex', gap: '16px', padding: '24px' }}>
 *   <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#111' }}>
 *   <button style={{ background: '#2563eb', color: 'white', borderRadius: '8px' }}>
 *   <p style={{ color: '#6b7280', marginTop: '8px' }}>
 *
 * CORRECT — Tailwind className for everything:
 *   <div className="flex gap-4 p-6">
 *   <h1 className="text-3xl font-bold text-gray-900">
 *   <button className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700">
 *   <p className="text-gray-500 mt-2">
 *
 * EXCEPTION — MapContainer MUST keep style for Leaflet to render:
 *   <MapContainer style={{ height: '500px', width: '100%' }} ...>   ← KEEP this one
 *
 * RULE: Replace every style={{}} with equivalent Tailwind classes.
 *       Only MapContainer retains style={{ height }}.
 */
import React from 'react';

// ✓ CORRECT — pure Tailwind, no inline styles:
export default function FixInlineStyleToTailwind() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of key metrics</p>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Area', value: '3,400 km²', color: 'bg-blue-50 text-blue-700' },
            { label: 'Active Sites', value: '142', color: 'bg-green-50 text-green-700' },
            { label: 'Alerts', value: '7', color: 'bg-red-50 text-red-700' },
          ].map((stat, i) => (
            <div key={i} className={`rounded-xl p-6 ${stat.color} font-semibold`}>
              <p className="text-sm opacity-75">{stat.label}</p>
              <p className="text-3xl font-bold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
          View Details
        </button>
      </main>
    </div>
  );
}
