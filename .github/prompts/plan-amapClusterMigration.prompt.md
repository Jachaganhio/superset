Plan to replace canvas overlay with native AMap rendering

- APIs to use
  - Cluster rendering: AMap JSAPI 2.0 `MarkerCluster` plugin with `renderClusterMarker` for custom cluster bubbles; fallback to legacy `AMap.MarkerClusterer` if needed.
  - Single-point rendering:
    - Many points / simple style → `MassMarks` with custom styles array keyed by metric buckets.
    - Fewer points / variable radius in pixels → `CircleMarker`.
    - Radius in real distance (km/mi) → `Circle` (radius in meters) for geodesic sizing.
  - Optional: `Text`/`LabelMarker` for metric labels; or draw inside `renderClusterMarker` canvas.

- Data transformations
  - Convert Supercluster GeoJSON to AMap marker data: `[lng, lat]` → `position`, spread `properties` into `extData`.
  - Pre-compute metrics (count, sum, min/max/mean/var/std) same as today; pass via `renderClusterMarker` or keep Supercluster.
  - Point radius mapping:
    - `Pixels` → `CircleMarker.radius = pointRadius/6` (or `radius` property)
    - `Kilometers/Miles` → meters (`km*1000`, `mi*1609.34`) then `Circle.setRadius(meters)`
  - Keep metric in `extData` for labels; normalize bounds for fitting.

- Integration with current props/state
  - `clusterer` (Supercluster):
    1) Keep it: use `getClusters` output, create markers with `isCluster` flag, feed to `MarkerCluster` (no built-in aggregation).
    2) Drop it: feed raw points to `MarkerCluster`; compute metrics in `renderClusterMarker` using `cluster.getMarkers()`.
  - Viewport: on `moveend/zoomend`, keep `onViewportChange`; no manual pixel projection needed.
  - Radius unit switch: choose `CircleMarker` vs `Circle` per unit before instantiation.
  - Metrics/labels: `extData.metric`; `renderClusterMarker` mirrors `computeClusterLabel`; single points optionally use `Text`.
  - Color/opacity: map `rgb` and `globalOpacity` to `fillColor`/`fillOpacity`/`strokeColor`/`strokeWeight`.
  - renderWhileDragging: pause refresh or rely on plugin incremental draw.

- Performance & events
  - Use `MassMarks` or `MarkerCluster` for >10k points; set `zooms` to hide at low zooms; avoid rebuilds—prefer `setMarkers` updates.
  - Debounce `moveend/zoomend`; avoid recreating clusterer unless data/style changes.
  - For labels, prefer drawing in `renderClusterMarker` to reduce DOM nodes.
  - Events: cluster click to zoom/focus; marker click/hover uses `extData` for tooltip; clean up with `setMap(null)` on unmount.

- Migration steps
  1) In `AMap.tsx`, load plugins: `AMap.MarkerCluster`, `AMap.Text`, `AMap.Circle/CircleMarker`; keep security config.
  2) Replace `renderClusters()` canvas logic with building marker data and initializing/updating `MarkerCluster` (or `MassMarks` for massive sets).
  3) Reuse existing color/radius/label logic inside `renderClusterMarker`; compute label with current `computeClusterLabel`.
  4) Single-point: pick `CircleMarker` (px) or `Circle` (meters); add `Text` or inline label when metric present.
  5) Wire events: click/hover to existing tooltip + `onViewportChange`; throttle move/zoom updates.
  6) Cleanup: reuse cluster instance; on unmount `cluster.setMap(null)` and clear circles/text.


- Documentation lookup (Context7 + references)
  - Use Context7 to consult AMap JSAPI 2.0 topics:
    - Clustering: `MarkerCluster` plugin and `renderClusterMarker` customization API.
    - Massive points: `MassMarks` API and style buckets.
    - Point geometry: `CircleMarker` (pixel radius) and `Circle` (meter radius).
    - Labels: `Text`/`LabelMarker` and in-cluster label strategies.
  - Confirm API surfaces before coding:
    - Update paths: `setMarkers`, `add/remove`, `setMap(null)` and destroy semantics.
    - Events: `click`, `mouseover`, `moveend`, `zoomend`, cluster click → markers list.
    - Styling: `fillColor`, `fillOpacity`, `strokeColor`, `strokeWeight`, `zooms`.
  - Superset alignment checklist:
    - Metric label parity with existing cluster label logic.
    - Radius unit mapping: pixels → `CircleMarker`, meters → `Circle.setRadius`.
    - Viewport sync via map events without manual pixel projection.

- Dev/test workflow (Docker + Chrome DevTools)
  - Start services (if not running):
    ```bash
    docker compose up --build
    # or
    docker compose -f docker-compose.yml up -d
    ```
  - Access UI: open `http://localhost:9000` and log in with `admin/admin` (default dev creds).
  - Exercise an AMap-based chart: pan, zoom, toggle metric labels, and switch radius units (px vs meters).
  - Chrome DevTools validation:
    - Performance: record during pan/zoom; cluster update work should be bounded; avoid long main-thread stalls or forced reflows.
    - Memory: take heap snapshots before/after navigating away; verify no detached DOM nodes; unmount should remove clusters/markers (`setMap(null)`).
    - React Profiler: ensure minimal re-renders on `moveend/zoomend`; no rerenders on every drag frame if not required.
    - Network: verify no unexpected API chatter on map interactions beyond intended queries.
  - Useful commands:
    ```bash
    docker compose ps
    docker compose logs -f superset-frontend
    docker compose logs -f superset
    docker compose restart superset-frontend
    ```

- Validation checklist (parity and quality)
  - Visual parity:
    - Cluster bubble labels match existing computation (text, formatting, thresholds).
    - Colors/opacity reflect current props; stroke/fill mapping consistent.
    - Radius mapping accurate for both pixels (`CircleMarker`) and meters (`Circle`).
  - Interaction:
    - Cluster click zooms/focuses as designed; marker hover/click shows tooltip with `extData`.
    - Viewport callbacks fire on `moveend/zoomend`; dragging behavior respects `renderWhileDragging` expectations.
  - Performance:
    - Large datasets: prefer `MassMarks` or tuned `MarkerCluster`; set `zooms` to hide at low zooms.
    - Debounced updates on move/zoom; avoid re-instantiating clusterer unless inputs change.
  - Cleanup & lifecycle:
    - On unmount, detach instances via `setMap(null)`; remove listeners and clear circles/text.
    - No memory leaks across mounts/unmounts; DOM node count returns to baseline after teardown.
