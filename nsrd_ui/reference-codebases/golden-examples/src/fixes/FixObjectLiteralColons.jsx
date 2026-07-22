/**
 * FIX EXAMPLE: Object literal missing colons between key and value
 *
 * ERRORS THIS FIXES:
 *   "Expected }, got string"
 *   "Expected : in object literal"
 *   "Unexpected string"
 *   "Transform failed" near object/array literal
 *   "Expected , but found string"
 *
 * CAUSE: Object literal keys written without the ":" separator.
 *
 * WRONG (causes build error):
 *   const data = [
 *     { year "1970s", title "Modern GIS", description "GIS matured..." },
 *     { id 1, label "Oak Ridge", value 42 }
 *   ];
 *
 *   const config = { color "blue" size 12 weight "bold" };
 *
 * CORRECT — every key MUST be followed by a colon before its value:
 *   const data = [
 *     { year: "1970s", title: "Modern GIS", description: "GIS matured..." },
 *     { id: 1, label: "Oak Ridge", value: 42 }
 *   ];
 *
 *   const config = { color: "blue", size: 12, weight: "bold" };
 *
 * RULE: JavaScript object syntax is always   key: value
 *       There are NO exceptions. Every comma-separated item needs its own colon.
 */
import React from 'react';

// ✓ CORRECT — all keys have colons:
const timelineData = [
  { year: '1960s', title: 'Origins', description: 'Early GIS work at Harvard.' },
  { year: '1970s', title: 'Expansion', description: 'Government adoption began.' },
  { year: '1980s', title: 'Commercial', description: 'First commercial GIS software.' },
  { year: '1990s', title: 'Desktop GIS', description: 'ArcGIS and MapInfo launched.' },
  { year: '2000s', title: 'Web GIS', description: 'Google Maps changed everything.' },
];

export default function FixObjectLiteralColons() {
  return (
    <ul className="space-y-3 p-6">
      {timelineData.map((item, i) => (
        <li key={i} className="flex gap-4 bg-white rounded-lg p-4 shadow-sm">
          <span className="font-bold text-blue-600 w-16 shrink-0">{item.year}</span>
          <div>
            <p className="font-semibold text-gray-900">{item.title}</p>
            <p className="text-gray-600 text-sm">{item.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
