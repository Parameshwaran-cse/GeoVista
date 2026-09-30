import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const API_BASE = 'http://localhost:8080/api/v1';

export default function Analytics({ indicators, selectedIndicator, mapData, setClickedFips }) {
  return (
    <div className="analytics-container">
      <div className="analytics-top">
        <Rankings indicators={indicators} setClickedFips={setClickedFips} />
        <DistributionChart 
          indicators={indicators} 
          selectedIndicator={selectedIndicator} 
          mapData={mapData} 
        />
      </div>
      <div className="analytics-bottom">
        <CorrelationHeatmap indicators={indicators} />
      </div>
    </div>
  );
}

function Rankings({ indicators, setClickedFips }) {
  const [metric, setMetric] = useState('health_score');
  const [order, setOrder] = useState('desc');
  const [rankings, setRankings] = useState([]);

  useEffect(() => {
    async function fetchRankings() {
      try {
        const res = await fetch(`${API_BASE}/rankings?metric=${encodeURIComponent(metric)}&order=${order}&limit=50`);
        if (res.ok) {
          setRankings(await res.json());
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchRankings();
  }, [metric, order]);

  return (
    <div className="rankings-panel">
      <div className="panel-header">
        <h3 className="panel-title">Top 50 Rankings</h3>
      </div>
      <div className="rankings-controls">
        <select value={metric} onChange={e => setMetric(e.target.value)}>
          <option value="health_score">Health Score</option>
          <option value="disparity_score">Disparity Score</option>
          {indicators.map(ind => (
            <option key={ind.name} value={ind.name}>{ind.label}</option>
          ))}
        </select>
        <select value={order} onChange={e => setOrder(e.target.value)}>
          <option value="desc">Descending Highest to Lowest</option>
          <option value="asc">Ascending Lowest to Highest</option>
        </select>
      </div>
      <div className="rankings-table-container">
        <table className="rankings-table">
          <thead>
            <tr>
              <th style={{width: '60px'}}>Rank</th>
              <th>County</th>
              <th>State</th>
              <th className="num-col">Value</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((r, i) => (
              <tr key={r.FIPS} onClick={() => setClickedFips(r.FIPS)}>
                <td style={{color: '#a1a1aa'}}>{i + 1}</td>
                <td style={{fontWeight: 500}}>{r.County}</td>
                <td>{r.State}</td>
                <td className="num-col">{r.value?.toFixed(4) || r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DistributionChart({ indicators, selectedIndicator, mapData }) {
  const [chartData, setChartData] = useState([]);
  const [indLabel, setIndLabel] = useState('');

  useEffect(() => {
    if (!mapData) return;
    
    let label = 'Overall Health Score';
    if (selectedIndicator !== 'overall') {
      const found = indicators.find(i => i.name === selectedIndicator);
      if (found) label = found.label;
    }
    setIndLabel(label);

    const values = [];
    Object.values(mapData).forEach(d => {
      if (d.value !== undefined && d.value !== null && !isNaN(d.value)) {
        values.push(d.value);
      }
    });

    if (values.length === 0) {
      setChartData([]);
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const numBins = 20;
    const binSize = (max - min) / numBins;

    const bins = Array(numBins).fill(0).map((_, i) => ({
      name: (min + i * binSize).toFixed(2),
      rangeEnd: min + (i + 1) * binSize,
      count: 0
    }));

    values.forEach(v => {
      if (binSize === 0) {
        bins[0].count++;
        return;
      }
      let binIdx = Math.floor((v - min) / binSize);
      if (binIdx >= numBins) binIdx = numBins - 1;
      bins[binIdx].count++;
    });

    setChartData(bins);
  }, [mapData, selectedIndicator, indicators]);

  return (
    <div className="dist-chart-panel">
      <div className="panel-header">
        <h3 className="panel-title">Value Distribution</h3>
        <span style={{fontSize: '0.85rem', color: '#52525b'}}>{indLabel}</span>
      </div>
      <div className="chart-container">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis 
                dataKey="name" 
                tick={{fontSize: 11, fill: '#71717a', fontFamily: "'IBM Plex Sans', sans-serif"}} 
                interval={2} 
                axisLine={false} 
                tickLine={false} 
                dy={10}
              />
              <YAxis 
                tick={{fontSize: 11, fill: '#71717a', fontFamily: "'IBM Plex Sans', sans-serif"}} 
                axisLine={false} 
                tickLine={false} 
              />
              <RechartsTooltip 
                formatter={(val) => [val, "Count"]} 
                labelFormatter={(lbl) => `Bin Start: ${lbl}`}
                contentStyle={{fontFamily: "'IBM Plex Sans', sans-serif", borderRadius: '4px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'}}
              />
              <Bar dataKey="count" fill="#4575b4" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{color: '#a1a1aa'}}>No data available for distribution.</p>
        )}
      </div>
    </div>
  );
}

function CorrelationHeatmap({ indicators }) {
  const [corr, setCorr] = useState(null);

  useEffect(() => {
    async function fetchCorr() {
      try {
        const res = await fetch(`${API_BASE}/analytics/correlation`);
        if (res.ok) setCorr(await res.json());
      } catch (err) {
        console.error(err);
      }
    }
    fetchCorr();
  }, []);

  if (!corr) return <div className="heatmap-panel" style={{alignItems: 'center', justifyContent: 'center'}}><span style={{fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', color: '#71717a'}}>Loading heatmap...</span></div>;

  const names = Object.keys(corr);
  
  // Diverging logic matching the CSS variables (Red-Orange vs Blue)
  // Negative corr (Worse relationship? It's just correlation)
  // Let's map Negative to Red-Orange (#d73027), Positive to Blue (#4575b4), Zero to White (#ffffff)
  const getColor = (val) => {
    if (val === null || val === undefined) return '#f4f4f5'; // gray for null
    
    if (val < 0) {
      // Red: 0 to -1
      // Interpolate from white (255,255,255) to #d73027 (215, 48, 39)
      const intensity = Math.abs(val);
      const r = Math.round(255 - (255 - 215) * intensity);
      const g = Math.round(255 - (255 - 48) * intensity);
      const b = Math.round(255 - (255 - 39) * intensity);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Blue: 0 to 1
      // Interpolate from white (255,255,255) to #4575b4 (69, 117, 180)
      const intensity = Math.abs(val);
      const r = Math.round(255 - (255 - 69) * intensity);
      const g = Math.round(255 - (255 - 117) * intensity);
      const b = Math.round(255 - (255 - 180) * intensity);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  const getLabel = (name) => {
    const f = indicators.find(i => i.name === name);
    return f ? f.label : name;
  };

  return (
    <div className="heatmap-panel">
      <div className="panel-header">
        <h3 className="panel-title">Correlation Matrix</h3>
      </div>
      <div className="heatmap-grid-container">
        <div className="heatmap-grid" style={{
          gridTemplateColumns: `150px repeat(${names.length}, 40px)`
        }}>
          {/* Header row */}
          <div className="hm-cell hm-corner" style={{background: 'transparent'}}></div>
          {names.map((n, i) => (
            <div key={n} className="hm-cell hm-header-col" title={getLabel(n)}>
              <span>{i + 1}</span>
            </div>
          ))}
          
          {/* Rows */}
          {names.map((rowName, rIdx) => (
            <React.Fragment key={rowName}>
              <div className="hm-cell hm-header-row" title={getLabel(rowName)}>
                {rIdx + 1}. {getLabel(rowName).substring(0, 16)}
              </div>
              {names.map((colName) => {
                const val = corr[rowName][colName];
                const c = getColor(val);
                return (
                  <div 
                    key={`${rowName}-${colName}`} 
                    className="hm-cell hm-val"
                    style={{ backgroundColor: c }}
                    title={`${getLabel(rowName)} vs ${getLabel(colName)}\nCorrelation: ${val !== null ? val.toFixed(4) : 'N/A'}`}
                  >
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <p className="hm-legend-note">
        Hover over cells to see exact values. Color intensity indicates correlation strength 
        (<span style={{color: '#d73027', fontWeight: 600}}>Red-Orange</span> = Negative, 
        <span style={{color: '#4575b4', fontWeight: 600, marginLeft: '4px'}}>Blue</span> = Positive).
      </p>
    </div>
  );
}
