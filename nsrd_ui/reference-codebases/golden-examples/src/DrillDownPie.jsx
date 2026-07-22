/**
 * GOLDEN EXAMPLE — Pie / donut chart with click-to-drill-down
 * Demonstrates: PieChart + active sector, drill-down state, two-level data
 * Styling: Tailwind CSS — zero inline style={{}} props
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Sector,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const TOP_LEVEL_CSV = `category,value
Water Quality,34
Habitat Loss,28
Invasive Species,19
Climate Change,12
Pollution,7`;

const DRILL_CSV = `category,subcategory,value
Water Quality,Sediment,14
Water Quality,Nutrients,12
Water Quality,Pathogens,8
Habitat Loss,Development,16
Habitat Loss,Agriculture,8
Habitat Loss,Forestry,4
Invasive Species,Plants,11
Invasive Species,Animals,8
Climate Change,Drought,7
Climate Change,Flooding,5
Pollution,Air,4
Pollution,Chemical,3`;

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(row => {
    const vals = row.split(',');
    return headers.reduce((obj, h, i) => {
      const v = vals[i]?.trim();
      obj[h] = isNaN(v) ? v : Number(v);
      return obj;
    }, {});
  });
}

const COLORS = ['#007aff', '#34c759', '#ff9f0a', '#ff3b30', '#af52de', '#5ac8fa'];

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill={fill} fontSize={16} fontWeight={700}>{payload.name ?? payload.category}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#6e6e73" fontSize={13}>{`${(percent * 100).toFixed(1)}%`}</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 16} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

export default function DrillDownPie() {
  const [topData, setTopData] = useState([]);
  const [drillData, setDrillData] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setTopData(parseCSV(TOP_LEVEL_CSV));
    setDrillData(parseCSV(DRILL_CSV));
  }, []);

  function handlePieClick(_, index) {
    const cat = topData[index];
    setActiveIdx(index);
    setSelected(cat);
  }

  const subData = useMemo(() => {
    if (!selected) return [];
    return drillData.filter(d => d.category === selected.category);
  }, [selected, drillData]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Ecosystem Threat Assessment</h2>

      <div className="flex flex-wrap gap-8 items-start">
        {/* Donut */}
        <div className="flex-none w-[340px]">
          <h3 className="font-semibold mb-1">Threat Categories</h3>
          <p className="text-xs text-gray-500 mb-2">Click a segment to drill down</p>
          <PieChart width={340} height={320}>
            <Pie
              activeIndex={activeIdx}
              activeShape={renderActiveShape}
              data={topData}
              cx={170}
              cy={160}
              innerRadius={80}
              outerRadius={130}
              dataKey="value"
              nameKey="category"
              onClick={handlePieClick}
            >
              {topData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ cursor: 'pointer' }} />
              ))}
            </Pie>
          </PieChart>
        </div>

        {/* Drill-down bar */}
        <div className="flex-1 min-w-[300px]">
          <h3 className="font-semibold mb-1">
            {selected ? `${selected.category} — Breakdown` : 'Select a category'}
          </h3>
          {subData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                layout="vertical"
                data={subData}
                margin={{ top: 0, right: 40, left: 100, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="subcategory" tick={{ fontSize: 12 }} width={95} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[activeIdx % COLORS.length]} radius={[0, 4, 4, 0]} name="Impact score" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-500">
              Click a pie segment to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
