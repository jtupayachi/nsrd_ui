/**
 * FIX EXAMPLE: Importing a CSS file that does not exist
 *
 * ERRORS THIS FIXES:
 *   "Cannot find module './Home.css'"
 *   "Cannot find module './Dashboard.css'"
 *   "Cannot find module './styles.css'"
 *   "Failed to resolve import './PageName.css'"
 *   "ENOENT: no such file or directory, open 'src/pages/Home.css'"
 *
 * CAUSE: The generated file contains a CSS import for a file that was never written.
 *        Vite resolves all imports at build time — a missing file is a hard error.
 *
 * WRONG (causes build error):
 *   import './Home.css';         // ← only valid if Home.css exists in same directory
 *   import './Dashboard.css';    // ← only valid if Dashboard.css exists
 *   import styles from './App.module.css';  // ← only valid if the module file exists
 *
 * CORRECT — remove CSS imports for files not in your output:
 *   // No CSS import needed — use Tailwind className on every element instead.
 *
 *   // The only safe CSS imports are:
 *   import 'leaflet/dist/leaflet.css';   // ← leaflet is installed, this file exists
 *
 * RULE: NEVER import a .css file unless you are also writing that file in the same response.
 *       Use Tailwind className="..." for all styling so no custom CSS files are needed.
 */
import React, { useState } from 'react';
// ✓ No .css import here — Tailwind handles all styles via className.
// ✓ Only leaflet CSS is safe to import (it ships with the leaflet package).

export default function FixNonExistentCSSImport() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">No CSS File Needed</h1>
        <p className="text-gray-600 mb-6">
          All styling uses Tailwind className — zero custom CSS files required.
        </p>
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => setCount(c => c + 1)}
        >
          Clicked {count} times
        </button>
      </div>
    </div>
  );
}
