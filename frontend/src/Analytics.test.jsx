import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Analytics from './Analytics';
import React from 'react';

// Mock Recharts
vi.mock('recharts', () => ({
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  CartesianGrid: () => <div />
}));

const mockIndicators = [
  { name: 'ind1', label: 'Indicator 1', direction: 'positive', weight: 0.5 }
];

const mockRankings = [
  { FIPS: '00001', County: 'County A', State: 'ST', value: 0.9 },
  { FIPS: '00002', County: 'County B', State: 'ST', value: 0.8 }
];

describe('Analytics Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/rankings')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRankings) });
      if (url.includes('/analytics/correlation')) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      return Promise.reject(new Error('not mocked'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('4. Test the Rankings table: metric/order updates fetch params, row click updates shared state', async () => {
    const setClickedFipsMock = vi.fn();
    render(<Analytics indicators={mockIndicators} selectedIndicator="overall" mapData={{}} setClickedFips={setClickedFipsMock} />);
    
    await waitFor(() => {
      expect(screen.getByText('County A')).toBeInTheDocument();
    });
    
    // Initial fetch should be metric=health_score&order=desc
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('metric=health_score'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('order=desc'));
    
    global.fetch.mockClear();
    
    // Change metric
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'ind1' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('metric=ind1'));
    });
    
    global.fetch.mockClear();
    
    // Change order
    fireEvent.change(selects[1], { target: { value: 'asc' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('order=asc'));
    });
    
    // Click row
    fireEvent.click(screen.getByText('County A'));
    expect(setClickedFipsMock).toHaveBeenCalledWith('00001');
  });
});
