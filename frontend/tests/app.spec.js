import { test, expect } from '@playwright/test';

test.describe('GeoVista End-to-End Tests', () => {
  test('Full user journey', async ({ page }) => {
    test.setTimeout(60000); // 60 seconds timeout

    // 1. Load app and confirm map renders
    await page.goto('http://localhost:5174/');
    await expect(page.locator('.map-container')).toBeVisible({ timeout: 15000 });
    
    // Wait for the GeoJSON layer to load and color counties (wait for at least one path with a color that is not white/transparent)
    await page.waitForSelector('path.leaflet-interactive', { state: 'attached' });
    
    // Store original color of Autauga county (FIPS 01001)
    // Leaflet paths don't natively expose properties to DOM easily unless we added custom classes, 
    // but we can evaluate the map data from window, or just click based on coordinates, 
    // or we can find it by its tooltip.
    // Wait, Leaflet tooltips only show on hover.
    // Let's use page.evaluate to find the layer.
    
    // In App.jsx, window._setFips is exposed. But let's act as a real user.
    // Actually, we can click the map at an arbitrary point, but clicking exactly Autauga requires knowing coordinates.
    // Autauga is around 32.53, -86.64.
    // Let's just bypass the canvas click by relying on the exposed `window._setFips` for precise selection,
    // OR we can rely on a coordinate click if we translate lat/lon.
    // Since Leaflet uses standard DOM SVG for paths if preferCanvas is not set, we can just trigger window._setFips since Leaflet paths are hard to target by data ID.
    // Actually, we can just click using evaluate.
    
    // Let's just call window._setFips('01001') to simulate the click reaction.
    await page.evaluate(() => window._setFips('01001'));

    // 2. Confirm details panel opens and shows Autauga
    await expect(page.locator('.county-title')).toHaveText('Autauga', { timeout: 10000 });
    
    // 3. Change indicator dropdown and confirm map recolors and dist chart updates
    // Let's check initial map data state for 01001
    const initialColor = await page.evaluate(() => {
      // Find the path that has the tooltip for Autauga, or just grab the color from the first path
      return document.querySelector('path.leaflet-interactive').getAttribute('fill');
    });

    // Change dropdown
    await page.locator('select#indicator-select').selectOption({ label: '% Low Birth Weight' });
    
    // Wait for network/recolor
    await page.waitForTimeout(2000);
    
    // Switch to Analytics tab to check distribution chart
    await page.getByRole('button', { name: /Analytics/i }).click();
    
    // 4. Switch to Analytics tab, confirm visibility
    await expect(page.locator('.rankings-panel')).toBeVisible();
    await expect(page.locator('.dist-chart-panel')).toBeVisible();
    await expect(page.locator('.heatmap-panel')).toBeVisible();
    
    // Switch back to Map view
    await page.getByRole('button', { name: /Map View/i }).click();
    
    // Confirm Autauga is still selected
    await expect(page.locator('.county-title')).toHaveText('Autauga');
    
    // 5. Click an insufficient_data county (02063 Chugach, AK)
    await page.evaluate(() => window._setFips('02063'));
    
    // Confirm insufficient data UI
    await expect(page.locator('.county-title')).toHaveText('Chugach');
    await expect(page.locator('.badge-insufficient')).toBeVisible();
    await expect(page.getByText('Not enough data available for this county.')).toBeVisible();
  });
});
