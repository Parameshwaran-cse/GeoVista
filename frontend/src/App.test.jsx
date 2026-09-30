import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import React from 'react';

// Mock Leaflet as it causes issues in jsdom without canvas
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  GeoJSON: () => <div data-testid="geojson" />
}));

// Mock Analytics to isolate App tests
vi.mock('./Analytics', () => ({
  default: ({ indicators }) => <div data-testid="analytics-mock">{indicators?.length} indicators</div>
}));

const mockIndicators = [
  { name: 'ind1', label: 'Indicator 1', direction: 'positive', weight: 0.5 },
  { name: 'ind2', label: 'Indicator 2', direction: 'negative', weight: 0.5 }
];

const mockGeoJson = { type: 'FeatureCollection', features: [] };

const mockRegions = [
  { FIPS: '00001', score_status: 'complete', high_disparity: false, classification: 'green' }
];

const mockThresholds = {
  classification: { green_min: 0.7, yellow_max: 0.7, red_max: 0.4 }
};

const mockMapData = {
  '00001': { value: 0.8, classification: 'green', score_status: 'complete' }
};

const mockRegionDetailComplete = {
  FIPS: '00001',
  County: 'Test County',
  State: 'TS',
  classification: 'green',
  score_status: 'complete',
  high_disparity: false,
  'Health Score': 0.8,
  'Disparity Score': 0.2,
  'ind1': 10,
  'ind1_norm': 0.8,
  'ind2': 5,
  'ind2_norm': 0.8
};

const mockRegionDetailPartial = {
  ...mockRegionDetailComplete,
  score_status: 'partial',
  'ind2': null,
  'ind2_norm': null
};

const mockRegionDetailInsufficient = {
  FIPS: '00002',
  County: 'Missing County',
  State: 'TS',
  classification: null,
  score_status: 'insufficient_data',
  high_disparity: false,
  'Health Score': null,
  'Disparity Score': null
};

describe('App Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/indicators')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockIndicators) });
      if (url.includes('/geojson')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGeoJson) });
      if (url.includes('/regions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRegions) });
      if (url.includes('/thresholds')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockThresholds) });
      if (url.includes('/map')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMapData) });
      if (url.includes('/region/00001')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRegionDetailComplete) });
      if (url.includes('/region/00002')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRegionDetailInsufficient) });
      if (url.includes('/region/partial')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRegionDetailPartial) });
      return Promise.reject(new Error('not mocked'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Test the indicator selector dropdown: renders options and triggers re-fetch', async () => {
    render(<App />);
    
    // Wait for initial load
    await waitFor(() => expect(screen.getByText('Indicator 1')).toBeInTheDocument());
    
    const select = screen.getByLabelText(/Indicator/i);
    expect(select.options.length).toBe(3); // overall + 2 indicators
    
    // Clear initial fetch calls for /map
    const mapCalls = global.fetch.mock.calls.filter(call => call[0].includes('/map'));
    expect(mapCalls.length).toBeGreaterThan(0);
    
    global.fetch.mockClear();
    
    // Change selection
    fireEvent.change(select, { target: { value: 'ind1' } });
    
    // Should refetch map data with new indicator
    await waitFor(() => {
      const newMapCalls = global.fetch.mock.calls.filter(call => call[0].includes('/map?indicator=ind1'));
      expect(newMapCalls.length).toBe(1);
    });
  });

  it('2. Test the Region Details panel (Complete state)', async () => {
    render(<App />);
    
    await waitFor(() => expect(screen.getByTestId('map-container')).toBeInTheDocument());
    
    // Simulate clicking a county by setting state directly or by mocking the global window._setFips
    window._setFips('00001');
    
    // Should render details
    await waitFor(() => {
      expect(screen.getByText('Test County')).toBeInTheDocument();
      expect(screen.getByText('Better Performance')).toBeInTheDocument(); // Green classification
      expect(screen.getByText('0.8000')).toBeInTheDocument(); // Health score
    });
  });

  it('2. Test the Region Details panel (Insufficient state)', async () => {
    render(<App />);
    
    await waitFor(() => expect(screen.getByTestId('map-container')).toBeInTheDocument());
    
    window._setFips('00002');
    
    await waitFor(() => {
      expect(screen.getByText('Missing County')).toBeInTheDocument();
      expect(screen.getAllByText('Insufficient Data').length).toBeGreaterThan(0);
      expect(screen.getByText(/Not enough data available/i)).toBeInTheDocument();
    });
  });

  it('2. Test the Region Details panel (Partial state)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('map-container')).toBeInTheDocument());
    
    global.fetch.mockImplementationOnce((url) => {
      if (url.includes('/region/00003')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRegionDetailPartial) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    
    window._setFips('00003');
    
    await waitFor(() => {
      expect(screen.getByText(/Partial Data/i)).toBeInTheDocument();
      expect(screen.getByText(/Missing: Indicator 2/i)).toBeInTheDocument();
    });
  });

  it('3. Test the Legend component renders dynamic thresholds', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Classification/i)).toBeInTheDocument());
    
    // Should contain the mocked threshold 0.700 and 0.400
    expect(screen.getAllByText(/0.700/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0.400/i).length).toBeGreaterThan(0);
  });

  it('5. Test empty/error states on failed fetch', async () => {
    global.fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));
    
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/i)).toBeInTheDocument();
    });
  });
});
