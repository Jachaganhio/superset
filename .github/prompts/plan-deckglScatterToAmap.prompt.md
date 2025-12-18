Plan to migrate deck.gl Scatterplot to native AMap rendering

## Overview
Replace deck.gl ScatterplotLayer with native AMap JSAPI 2.0 overlays (Circle/CircleMarker) to render scatter points, maintaining feature parity with existing deck.gl implementation while improving performance and reducing dependencies.

## Branch Management
1. **Create feature branch from current amap branch**
   ```bash
   git checkout amap
   git pull origin amap
   git checkout -b deckgl-scatter-to-amap
   ```

2. **Work iteratively on feature branch**
   - Commit logical units (types → rendering → events → cleanup)
   - Test after each major change
   - Push to remote for backup:
     ```bash
     git push origin deckgl-scatter-to-amap
     ```

3. **Merge back to amap when complete**
   ```bash
   git checkout amap
   git merge deckgl-scatter-to-amap
   git push origin amap
   ```

## Current Implementation Analysis

### deck.gl Scatterplot Architecture
- **Location**: `superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/`
- **Main component**: `Scatter.tsx` - uses deck.gl ScatterplotLayer
- **Data structure**: Array of `{ position: [lng, lat], radius: number, color: [r,g,b,a], metric: number, ... }`
- **Key features**:
  - Variable radius per point (controlled by metric)
  - Radius units: `square_m`, `square_km`, `square_miles`, `radius_m`, `radius_km`, `radius_miles`
  - Color mapping: categorical (via dimension) or single color picker
  - Min/max radius constraints (radiusMinPixels, radiusMaxPixels)
  - Multiplier for radius scaling
  - Tooltip: shows position, category, metric
  - Cross-filtering support via click
  - Highlight layer for filtered data

### Target AMap APIs
- **Circle** (geodesic radius in meters) for:
  - `square_m` → √(area/π) meters
  - `square_km` → √(area/π) * 1000 meters
  - `square_miles` → √(area/π) * 1609.34 meters
  - `radius_m` → direct meters
  - `radius_km` → * 1000
  - `radius_miles` → * 1609.34
- **CircleMarker** (pixel radius) for:
  - Points without explicit radius metric
  - Min/max pixel clamping
- **Text** (optional) for inline metric labels if needed
- **AMap event system** for hover/click interactions

## Migration Steps

### Step 1: Create New AMap-based Scatter Component (DO NOT modify existing deck.gl files)
**File**: `superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/ScatterAMap.tsx`

- Load AMap SDK with Circle/CircleMarker plugins
- Initialize AMap instance in container
- Manage viewport state (center, zoom) synced with formData
- Security config support (amapApiKey, amapSecurityKey from payload)

### Step 2: Data Transformation
- Reuse existing `transformProps.ts` output format
- Convert `features` array to AMap overlay instances:
  ```typescript
  features.forEach(feature => {
    const [lng, lat] = feature.position;
    const radiusMeters = computeRadius(feature.radius, fd.point_unit, fd.multiplier);
    const color = feature.color || defaultColor;
    
    if (isGeodesicUnit(fd.point_unit)) {
      // Use AMap.Circle for meter-based radius
      const circle = new AMap.Circle({
        center: [lng, lat],
        radius: radiusMeters,
        fillColor: rgbaToHex(color),
        fillOpacity: color[3] / 255,
        ...
      });
    } else {
      // Use AMap.CircleMarker for pixel radius (with min/max clamp)
      const circleMarker = new AMap.CircleMarker({
        center: [lng, lat],
        radius: clamp(radiusPixels, fd.min_radius, fd.max_radius),
        ...
      });
    }
  });
  ```

### Step 3: Radius Unit Mapping
```typescript
function computeRadius(
  value: number,
  unit: string,
  multiplier: number = 1
): number {
  const adjusted = value * multiplier;
  
  switch (unit) {
    case 'square_m':
      return Math.sqrt(adjusted / Math.PI); // meters
    case 'square_km':
      return Math.sqrt(adjusted / Math.PI) * 1000;
    case 'square_miles':
      return Math.sqrt(adjusted / Math.PI) * 1609.34;
    case 'radius_m':
      return adjusted;
    case 'radius_km':
      return adjusted * 1000;
    case 'radius_miles':
      return adjusted * 1609.34;
    default:
      return adjusted; // fallback
  }
}
```

### Step 4: Color Handling
- **Categorical colors**: Apply per-category color from formData or use default palette
- **Single color picker**: `fd.color_picker` → `rgba(r, g, b, a)`
- Map to AMap overlay style:
  ```typescript
  fillColor: `rgba(${r}, ${g}, ${b}, ${a})`,
  fillOpacity: a,
  strokeColor: darken(fillColor, 0.2),
  strokeWeight: 1
  ```

### Step 5: Event Wiring
- **Hover tooltip**:
  - `circle.on('mouseover', (e) => { setTooltip({ ...content, x, y }); })`
  - Display position, category, metric (reuse existing tooltip generator)
- **Click cross-filtering**:
  - `circle.on('click', (e) => { emitCrossFilters({ ... }); })`
  - Store clicked feature data in overlay's `extData`
- **Context menu**: right-click → `onContextMenu(e)`

### Step 6: Overlay Lifecycle Management
- **Detach on re-render**:
  ```typescript
  private overlays: Array<AMapCircleInstance | AMapCircleMarkerInstance> = [];
  
  private clearOverlays() {
    this.overlays.forEach(ov => ov.setMap(null));
    this.overlays = [];
  }
  
  componentDidUpdate(prevProps) {
    if (dataChanged(prevProps, this.props)) {
      this.clearOverlays();
      this.renderPoints();
    }
  }
  
  componentWillUnmount() {
    this.clearOverlays();
    this.map?.destroy();
  }
  ```

### Step 7: Highlight Layer for Filtering
- When `filterState.value` exists (bounding box selection):
  - Keep main overlays at reduced opacity (0.3)
  - Create additional Circle/CircleMarker overlays for points inside bounds
  - Use `HIGHLIGHT_COLOR_ARRAY` (#ffc107 yellow)
  - Higher zIndex to render on top

### Step 8: Integration with Existing Plugin System
**File**: `superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/index.ts`

- **Option A (Gradual)**: Add conditional logic to choose between deck.gl and AMap based on feature flag or mapStyle
  ```typescript
  loadChart: () => {
    const useAMap = checkAmapFeatureFlag(); // or detect amap:// style
    return useAMap 
      ? import('./ScatterAMap')
      : import('./Scatter');
  }
  ```

- **Option B (Direct replacement)**: Replace deck.gl import with AMap version
  ```typescript
  loadChart: () => import('./ScatterAMap'),
  ```

### Step 9: Control Panel Adjustments (if needed)
**File**: `superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/controlPanel.ts`

- Verify all existing controls work with AMap renderer:
  - `point_unit` dropdown
  - `min_radius`, `max_radius` sliders
  - `multiplier` input
  - `color_picker`
  - `dimension` (for categorical colors)
- Add AMap-specific controls if needed (e.g., security key)

## Type Definitions

**File**: `superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/amapTypes.ts`

```typescript
interface AMapScatterOptions {
  center: [number, number];
  radius: number; // meters for Circle, pixels for CircleMarker
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  zIndex: number;
  extData: {
    position: [number, number];
    metric?: number;
    category?: string;
    [key: string]: any;
  };
}

interface AMapCircleInstance {
  setMap: (map: AMapMapInstance | null) => void;
  on: (event: string, handler: (e: any) => void) => void;
  off: (event: string, handler: (e: any) => void) => void;
  getExtData: () => any;
}

interface AMapCircleMarkerInstance {
  setMap: (map: AMapMapInstance | null) => void;
  on: (event: string, handler: (e: any) => void) => void;
  off: (event: string, handler: (e: any) => void) => void;
  getExtData: () => any;
}
```

## Dev/Test Workflow

### Local Development
1. **Start dev environment** (from workspace root)
   ```bash
   docker compose up --build
   # or host dev server:
   cd superset-frontend && npm run dev-server
   ```

2. **Access UI**: http://localhost:9000 (admin/admin)

3. **Create deck.gl Scatterplot chart**:
   - Dataset: Any table with lat/lon columns (e.g., `long_lat` example table)
   - Viz type: "deck.gl Scatterplot"
   - Configure: spatial columns, point radius metric, unit, multiplier
   - Save and observe baseline behavior

4. **Switch to AMap renderer** (after implementation):
   - Change mapbox_style to `amap://styles/normal` (or add feature flag)
   - Refresh chart
   - Verify points render at same positions/sizes/colors

### Chrome DevTools Validation
- **Elements panel**: Inspect DOM for AMap Circle/CircleMarker overlays (no deck.gl canvas)
- **Performance**: Record during pan/zoom; ensure smooth <16ms frames
- **Memory**: Take heap snapshot before/after chart mount/unmount; verify no leaks
- **Network**: Confirm AMap JSAPI loads; no mapbox tile requests
- **Console**: Check for errors during overlay creation/destruction

### Visual Regression Checklist
- [ ] Point positions match deck.gl baseline (same lat/lon)
- [ ] Radius scaling accurate for all units (square_m, radius_km, etc.)
- [ ] Min/max radius constraints applied correctly
- [ ] Multiplier effect consistent
- [ ] Colors match (categorical and single picker)
- [ ] Tooltip shows correct position/category/metric on hover
- [ ] Click triggers cross-filter (if enabled)
- [ ] Highlight layer renders yellow circles for filtered points
- [ ] Opacity dimming works when filter active
- [ ] Pan/zoom updates viewport smoothly
- [ ] Chart unmount clears all overlays (no residual DOM)

## Performance Optimization
- **Batch overlay creation**: Use `map.add([array])` if AMap supports batch add
- **Debounce viewport updates**: Throttle `moveend`/`zoomend` to avoid re-render spam
- **Conditional rendering**: Hide overlays outside visible bounds using `zooms: [minZoom, maxZoom]`
- **Use MassMarks for >10k points**: Switch to MassMarks API if point count exceeds threshold
  ```typescript
  if (features.length > 10000) {
    const massMarks = new AMap.MassMarks(
      features.map(f => ({ lnglat: f.position, style: getStyleIndex(f) })),
      { styles: generateStyleArray() }
    );
    massMarks.setMap(map);
  }
  ```

## Testing Strategy
1. **Unit tests**: Test radius conversion functions, color mapping, bounds filtering
   - File: `superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/ScatterAMap.test.ts`

2. **Integration tests**: Mount component with sample data, verify overlays created
   - Use React Testing Library with AMap mock

3. **E2E tests** (Playwright, not Cypress):
   ```typescript
   test('AMap Scatterplot renders points and responds to interactions', async ({ page }) => {
     await page.goto('http://localhost:8088/explore/?form_data=...');
     await page.waitForSelector('.amap-container');
     
     // Verify points rendered
     const circles = await page.locator('.amap-circle').count();
     expect(circles).toBeGreaterThan(0);
     
     // Hover and check tooltip
     await page.hover('.amap-circle >> nth=0');
     await expect(page.locator('.deckgl-tooltip')).toBeVisible();
     
     // Pan map and verify re-render
     await page.mouse.move(200, 200);
     await page.mouse.down();
     await page.mouse.move(400, 400);
     await page.mouse.up();
     // Check overlay count updated
   });
   ```

## Documentation Updates
- **UPDATING.md**: Add breaking change notice if removing deck.gl dependency
  ```markdown
  ### deck.gl Scatterplot now uses AMap rendering
  
  The `deck_scatter` visualization type has been migrated from deck.gl ScatterplotLayer 
  to native AMap Circle/CircleMarker overlays. Visual appearance and functionality remain 
  the same, but underlying rendering engine has changed. If you experience issues, verify:
  - `amapApiKey` is configured in payload
  - Map style uses `amap://` prefix (e.g., `amap://styles/normal`)
  - Radius units and multiplier settings are correct
  ```

- **docs/**: Update "Deck.gl Scatterplot" chart guide with AMap-specific notes
  - Mention native overlay rendering
  - Link to AMap JSAPI documentation
  - Note performance improvements for large datasets

## Rollback Plan
If issues arise post-deployment:
1. **Feature flag rollback**: Toggle flag to revert to deck.gl renderer
2. **Branch revert**: 
   ```bash
   git revert <merge-commit-hash>
   git push origin amap
   ```
3. **Hotfix**: Keep deck.gl as fallback until AMap version stabilized

## Success Criteria
- [ ] All existing deck.gl Scatterplot features work with AMap renderer
- [ ] No visual regressions (radius, color, position accuracy)
- [ ] Performance equal or better (pan/zoom FPS, memory usage)
- [ ] Unit/integration/E2E tests pass
- [ ] No console errors or memory leaks
- [ ] Documentation updated
- [ ] Code review approved
- [ ] Merged to `amap` branch and deployed

## Reference Materials
- **AMap JSAPI 2.0 Docs**: https://lbs.amap.com/api/javascript-api-v2/documentation
  - Circle: https://lbs.amap.com/api/javascript-api-v2/documentation#circle
  - CircleMarker: https://lbs.amap.com/api/javascript-api-v2/documentation#circlemarker
  - Events: https://lbs.amap.com/api/javascript-api-v2/guide/abc/events
- **Existing AMap implementation**: `superset-frontend/plugins/legacy-plugin-chart-map-box/src/AMap.tsx`
- **deck.gl Scatter reference**: `superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Scatter/Scatter.tsx`
- **Previous canvas-to-AMap migration plan**: `plan/plan-amapClusterMigration.prompt.md`
