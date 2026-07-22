/**
 * FIX EXAMPLE: Unclosed JSX tag / missing closing ">" on opening tag
 *
 * ERRORS THIS FIXES:
 *   "Expected > but found <"
 *   "Expected > but found identifier"
 *   "Unexpected token, expected >"
 *   "Unterminated JSX contents"
 *   "Expected closing tag for <div>"
 *   "JSX element is missing closing tag"
 *
 * CAUSE 1: An opening tag is missing its final ">":
 *   <h2 className="text-xl font-bold"    ← missing >
 *     More content here
 *   </h2>
 *
 * CAUSE 2: Self-closing tag missing "/" before ">":
 *   <img src="photo.jpg" alt="Photo"   ← missing />
 *
 * CAUSE 3: A closing tag is missing its ">":
 *   <div className="card">
 *     <h2>Title</h2
 *   </div>                              ← h2 closing tag missing >
 *
 * CORRECT — every tag fully closed on the line it opens:
 *   <h2 className="text-xl font-bold">Title</h2>
 *   <img src="photo.jpg" alt="Photo" />
 *   <div className="card"><h2>Title</h2></div>
 *
 * RULE: Check that EVERY opening tag ends with ">" and every self-closing tag
 *       ends with "/>". A tag that spans multiple lines must still have its ">"
 *       as the last character of the last attribute line.
 */
import React from 'react';

// ✓ CORRECT — every tag fully closed:
const cards = [
  { id: 1, title: 'Hydrology', value: '2,340 km²', icon: '💧' },
  { id: 2, title: 'Forest Cover', value: '68%', icon: '🌲' },
  { id: 3, title: 'Species', value: '1,205', icon: '🦅' },
];

export default function FixMissingClosingTag() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
      {cards.map(card => (
        <div key={card.id} className="bg-white rounded-xl shadow-md p-6 text-center">
          <div className="text-4xl mb-2">{card.icon}</div>
          <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
          <p className="text-2xl font-bold text-blue-600 mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
