import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import Analytics from './Analytics';
import { Map, BarChart3, AlertCircle, Info, FileX, Activity } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './App.css';

const API_BASE = 'http://localhost:8080/api/v1';

// Updated: Colorblind-safe diverging palette (ColorBrewer RdYlBu inspired)
// Green -> Blue (#4575b4) - Better
// Yellow -> Amber (#fdae61) - Middle
// Red -> Red-Orange (#d73027) - Worse
const COLORS = {
  green: '#4575b4',
  yellow: '#fdae61',
  red: '#d73027',
  default: '#e4e4e7'
};

function App() {
  const [indicators, setIndicators] = useState([]);
  const [selectedIndicator, setSelectedIndicator] = useState('overall');
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [regions, setRegions] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [clickedFips, setClickedFips] = useState(null);
  const [clickedCountyData, setClickedCountyData] = useState(null);
  const [currentTab, setCurrentTab] = useState('map');
  
  useEffect(() => {
    window._setFips = setClickedFips;
  }, []);

  // Fetch initial data on mount
  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoading(true);
        const [indRes, geoRes, regRes, thrRes] = await Promise.all([
          fetch(`${API_BASE}/indicators`),
          fetch(`${API_BASE}/geojson/counties`),
          fetch(`${API_BASE}/regions`),
          fetch(`${API_BASE}/thresholds`)
        ]);
        
        if (!indRes.ok || !geoRes.ok || !regRes.ok || !thrRes.ok) {
          throw new Error('Failed to fetch initial data');
        }

        setIndicators(await indRes.json());
        setGeoJsonData(await geoRes.json());
        setRegions(await regRes.json());
        setThresholds(await thrRes.json());
      } catch (err) {
        setError(err.message);
      }
    }
    fetchInitialData();
  }, []);

  // Fetch map data whenever indicator changes
  useEffect(() => {
    async function fetchMapData() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/map?indicator=${selectedIndicator}`);
        if (!res.ok) throw new Error('Failed to fetch map data');
        const data = await res.json();
        setMapData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchMapData();
  }, [selectedIndicator]);

  // Fetch detailed county data when a county is clicked
  useEffect(() => {
    async function fetchCountyDetails() {
      if (!clickedFips) {
        setClickedCountyData(null);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/region/${clickedFips}`);
        if (!res.ok) {
          setClickedCountyData(null);
          return;
        }
        setClickedCountyData(await res.json());
      } catch (err) {
        console.error("Failed to fetch county details", err);
      }
    }
    fetchCountyDetails();
  }, [clickedFips]);

  // Handle map interaction
  const onEachFeature = (feature, layer) => {
    const fips = feature.id || feature.properties.id;
    const countyData = mapData ? mapData[fips] : null;

    layer.on({
      click: () => {
        setClickedFips(fips);
      }
    });

    if (countyData) {
      const { NAME, STATE } = feature.properties;
      let displayValue = countyData.value !== undefined && countyData.value !== null 
                         ? countyData.value.toFixed(4) 
                         : 'N/A';
                         
      const tooltipContent = `
        <div style="font-family: 'IBM Plex Sans', sans-serif;">
          <strong>${NAME}, ${STATE}</strong><br/>
          <span style="color: #52525b">Value: ${displayValue}</span>
        </div>
      `;
      layer.bindTooltip(tooltipContent, { direction: 'top', sticky: true, className: 'custom-tooltip' });
    }
  };

  const getStyle = (feature) => {
    const fips = feature.id || feature.properties.id;
    const countyData = mapData ? mapData[fips] : null;
    
    let fillColor = COLORS.default;
    if (countyData && countyData.classification && COLORS[countyData.classification]) {
      fillColor = COLORS[countyData.classification];
    }
    
    if (fips === clickedFips) {
      return { fillColor, weight: 3, opacity: 1, color: '#18181b', fillOpacity: 1 };
    }

    return { fillColor, weight: 1, opacity: 0.5, color: '#ffffff', fillOpacity: 0.85 };
  };

  // Compute summary stats
  const totalCount = regions.length;
  const missingCount = regions.filter(r => r.score_status === 'insufficient_data').length;
  const highDispCount = regions.filter(r => r.high_disparity === true).length;

  if (error) return <div className="p-4" style={{color: COLORS.red}}>Error: {error}</div>;

  return (
    <div className="layout">
      <header className="header">
        <h1>GeoVista-HDX</h1>
        
        <div className="tabs">
          <button className={`tab-btn ${currentTab === 'map' ? 'active' : ''}`} onClick={() => setCurrentTab('map')}>
            <Map size={16} style={{display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom'}} /> 
            Map View
          </button>
          <button className={`tab-btn ${currentTab === 'analytics' ? 'active' : ''}`} onClick={() => setCurrentTab('analytics')}>
            <BarChart3 size={16} style={{display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom'}} /> 
            Analytics
          </button>
        </div>
        
        <div className="selector-container">
          <label htmlFor="indicator-select">Indicator</label>
          <select id="indicator-select" value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)}>
            <option value="overall">Overall Health Score</option>
            {indicators.map((ind) => (
              <option key={ind.name} value={ind.name}>{ind.label}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="summary-cards">
        <div className="card">
          <span className="card-label">Total Counties</span>
          <span className="card-value">{totalCount.toLocaleString()}</span>
        </div>
        <div className="card">
          <span className="card-label" style={{color: COLORS.green}}><Activity size={14} /> High Performance</span>
          <span className="card-value">{regions.filter(r => r.classification === 'green').length.toLocaleString()}</span>
        </div>
        <div className="card">
          <span className="card-label" style={{color: COLORS.yellow}}><Activity size={14} /> Moderate Performance</span>
          <span className="card-value">{regions.filter(r => r.classification === 'yellow').length.toLocaleString()}</span>
        </div>
        <div className="card">
          <span className="card-label" style={{color: COLORS.red}}><Activity size={14} /> Low Performance</span>
          <span className="card-value">{regions.filter(r => r.classification === 'red').length.toLocaleString()}</span>
        </div>
        <div className="card">
          <span className="card-label"><AlertCircle size={14} /> High Disparity</span>
          <span className="card-value">{highDispCount.toLocaleString()}</span>
        </div>
        <div className="card">
          <span className="card-label"><FileX size={14} /> Insufficient Data</span>
          <span className="card-value">{missingCount}</span>
        </div>
      </div>
      
      <div className="main-content">
        {currentTab === 'map' ? (
          <>
            <div className="map-container">
              {loading && <div className="loading-overlay">Loading...</div>}
              
              {geoJsonData && mapData && (
                <MapContainer center={[38.5, -96]} zoom={4.5} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                  <GeoJSON key={`${selectedIndicator}-${clickedFips}`} data={geoJsonData} style={getStyle} onEachFeature={onEachFeature} />
                </MapContainer>
              )}

              {thresholds && (
                <div className="legend">
                  <h4>Classification</h4>
                  <div className="legend-item">
                    <span className="swatch" style={{backgroundColor: COLORS.green}}></span>
                    Better Performance (&ge; {thresholds.classification.yellow_max.toFixed(3)})
                  </div>
                  <div className="legend-item">
                    <span className="swatch" style={{backgroundColor: COLORS.yellow}}></span>
                    Moderate ({thresholds.classification.red_max.toFixed(3)} &ndash; {thresholds.classification.yellow_max.toFixed(3)})
                  </div>
                  <div className="legend-item">
                    <span className="swatch" style={{backgroundColor: COLORS.red}}></span>
                    Worse Performance (&lt; {thresholds.classification.red_max.toFixed(3)})
                  </div>
                  <div className="legend-item mt-2">
                    <span className="swatch" style={{backgroundColor: COLORS.default}}></span>
                    Insufficient Data
                  </div>
                </div>
              )}
            </div>
            
            <aside className={`details-panel ${clickedCountyData ? 'open' : ''}`} style={{ transform: clickedCountyData ? 'translateX(0)' : 'translateX(-110%)' }}>
              {clickedCountyData && (
                <>
                  <div className="details-header">
                    <div>
                      <h2 className="county-title">{clickedCountyData.County}</h2>
                      <span className="county-state">State of {clickedCountyData.State}</span>
                    </div>
                    <button className="close-btn" onClick={() => setClickedFips(null)}>✕</button>
                  </div>
                  <RegionDetails countyData={clickedCountyData} indicators={indicators} />
                </>
              )}
            </aside>
          </>
        ) : (
          <div className="analytics-page">
            <Analytics 
              indicators={indicators} 
              selectedIndicator={selectedIndicator} 
              mapData={mapData} 
              setClickedFips={(fips) => {
                setClickedFips(fips);
                setCurrentTab('map'); // Switch to map when a row is clicked
              }} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RegionDetails({ countyData, indicators }) {
  const { 
    classification, score_status, high_disparity 
  } = countyData;

  const healthScore = countyData['Health Score'];
  const dispScore = countyData['Disparity Score'];
  
  const isComplete = score_status === 'complete';
  const isPartial = score_status === 'partial';
  const isMissing = score_status === 'insufficient_data';

  // Determine available and missing indicators
  const availableInds = [];
  const missingInds = [];
  
  indicators.forEach(ind => {
    if (countyData[ind.name] !== undefined && countyData[ind.name] !== null) {
      availableInds.push(ind);
    } else {
      missingInds.push(ind);
    }
  });

  return (
    <div className="details-content">
      <div className="badge-row">
        {high_disparity && (
          <div className="badge-high-disparity">
            <AlertCircle size={12} /> High Disparity Flag
          </div>
        )}

        {isMissing ? (
          <div className="badge-insufficient">
            <FileX size={12} style={{display:'inline', verticalAlign:'text-bottom', marginRight:'4px'}} /> Insufficient Data
          </div>
        ) : (
          <div className="badge" style={{backgroundColor: COLORS[classification]}}>
            {classification === 'green' ? 'Better Performance' : classification === 'yellow' ? 'Moderate Performance' : 'Worse Performance'}
          </div>
        )}
      </div>

      {isMissing ? (
        <div className="missing-notice">
          <p><Info size={14} style={{display:'inline', verticalAlign:'text-bottom'}}/> <strong>Not enough data available for this county.</strong></p>
          <p className="missing-list">A complete score requires robust indicator reporting.</p>
        </div>
      ) : (
        <>
          <div className="scores-grid">
            <div className="score-box">
              <span className="score-label">Health Score</span>
              <span className="score-val">{healthScore.toFixed(4)}</span>
            </div>
            <div className="score-box">
              <span className="score-label">Disparity Score</span>
              <span className="score-val">{dispScore.toFixed(4)}</span>
            </div>
          </div>
          
          {isPartial && (
            <div className="partial-notice mt-4">
              <p><Info size={14} style={{display:'inline', verticalAlign:'text-bottom'}}/> <strong>Partial Data ({availableInds.length}/11)</strong></p>
              <p className="missing-list">Missing: {missingInds.map(i => i.label).join(', ')}</p>
            </div>
          )}

          <div className="indicators-list mt-4">
            <h3>Component Indicators</h3>
            {availableInds.map(ind => (
              <div key={ind.name} className="indicator-row">
                <span className="ind-label">{ind.label}</span>
                <div className="ind-metrics">
                  <span className="ind-val" title="Raw Value">{countyData[ind.name]}</span>
                  <span className="ind-norm" title="Normalized">({countyData[ind.name + '_norm'].toFixed(2)})</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
