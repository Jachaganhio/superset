/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { Component, createRef, RefObject } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import Supercluster from 'supercluster';
import './MapBox.css';

// AMap type declarations
declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
  }
}

interface AMapInstance {
  Map: new (
    container: HTMLElement | string,
    options: AMapMapOptions,
  ) => AMapMapInstance;
  MassMarks: new (
    data: MassMarkData[],
    options: MassMarksOptions,
  ) => AMapMassMarksInstance;
  LngLat: new (lng: number, lat: number) => AMapLngLat;
  Pixel: new (x: number, y: number) => AMapPixel;
  Size: new (width: number, height: number) => AMapSize;
}

interface AMapMapOptions {
  zoom?: number;
  center?: [number, number];
  mapStyle?: string;
  viewMode?: '2D' | '3D';
  pitch?: number;
  rotation?: number;
}

interface AMapMapInstance {
  destroy: () => void;
  setZoom: (zoom: number) => void;
  setCenter: (center: [number, number]) => void;
  setMapStyle: (style: string) => void;
  getZoom: () => number;
  getCenter: () => AMapLngLat;
  getBounds: () => AMapBounds;
  on: (event: string, handler: (e: AMapEvent) => void) => void;
  off: (event: string, handler: (e: AMapEvent) => void) => void;
  add: (overlay: AMapMassMarksInstance) => void;
  remove: (overlay: AMapMassMarksInstance) => void;
}

interface AMapLngLat {
  getLng: () => number;
  getLat: () => number;
}

interface AMapBounds {
  getSouthWest: () => AMapLngLat;
  getNorthEast: () => AMapLngLat;
}

interface AMapPixel {
  getX: () => number;
  getY: () => number;
}

interface AMapSize {
  getWidth: () => number;
  getHeight: () => number;
}

interface AMapEvent {
  lnglat?: AMapLngLat;
  target?: AMapMapInstance;
}

interface MassMarkData {
  lnglat: [number, number];
  name?: string;
  style?: number;
  [key: string]: unknown;
}

interface MassMarksOptions {
  opacity?: number;
  zIndex?: number;
  cursor?: string;
  style?: MassMarkStyle | MassMarkStyle[];
}

interface MassMarkStyle {
  url?: string;
  size?: AMapSize;
  anchor?: AMapPixel;
  fillColor?: string;
  strokeColor?: string;
  lineWidth?: number;
}

interface AMapMassMarksInstance {
  setMap: (map: AMapMapInstance | null) => void;
  setData: (data: MassMarkData[]) => void;
  setStyle: (style: MassMarkStyle | MassMarkStyle[]) => void;
  on: (event: string, handler: (e: MassMarkEvent) => void) => void;
}

interface MassMarkEvent {
  data: MassMarkData;
  target: AMapMassMarksInstance;
}

interface ClusterProperties {
  cluster?: boolean;
  point_count?: number;
  sum?: number;
  min?: number;
  max?: number;
  squaredSum?: number;
  metric?: number;
  radius?: number;
}

interface ClusterFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: ClusterProperties;
}

export interface AMapProps {
  width: number;
  height: number;
  aggregatorName?: string;
  clusterer: Supercluster;
  globalOpacity: number;
  hasCustomMetric?: boolean;
  mapStyle: string;
  amapApiKey: string;
  amapSecurityKey?: string;
  onViewportChange: (viewport: {
    latitude: number;
    longitude: number;
    zoom: number;
  }) => void;
  pointRadius: number;
  pointRadiusUnit: string;
  renderWhileDragging: boolean;
  rgb: RegExpExecArray;
  bounds: [[number, number], [number, number]];
}

interface AMapState {
  mapLoaded: boolean;
  error: string | null;
}

const NOOP = () => {};
export const DEFAULT_MAX_ZOOM = 16;
export const DEFAULT_POINT_RADIUS = 60;

// Convert AMap style identifier to full URL
const getAmapStyleUrl = (style: string): string => {
  if (style.startsWith('amap://styles/')) {
    return style;
  }
  // Handle legacy mapbox:// URLs by mapping to AMap equivalents
  if (style.includes('mapbox://')) {
    const styleMap: Record<string, string> = {
      'mapbox://styles/mapbox/streets-v9': 'amap://styles/normal',
      'mapbox://styles/mapbox/dark-v9': 'amap://styles/dark',
      'mapbox://styles/mapbox/light-v9': 'amap://styles/light',
      'mapbox://styles/mapbox/satellite-streets-v9': 'amap://styles/satellite',
      'mapbox://styles/mapbox/satellite-v9': 'amap://styles/satellite',
      'mapbox://styles/mapbox/outdoors-v9': 'amap://styles/macaron',
    };
    return styleMap[style] || 'amap://styles/normal';
  }
  return `amap://styles/${style}`;
};

class AMap extends Component<AMapProps, AMapState> {
  static defaultProps = {
    width: 400,
    height: 400,
    globalOpacity: 1,
    onViewportChange: NOOP,
    pointRadius: DEFAULT_POINT_RADIUS,
    pointRadiusUnit: 'Pixels',
  };

  private containerRef: RefObject<HTMLDivElement>;

  private map: AMapMapInstance | null = null;

  private AMapSDK: AMapInstance | null = null;

  private massMarks: AMapMassMarksInstance | null = null;

  private canvasRef: RefObject<HTMLCanvasElement>;

  constructor(props: AMapProps) {
    super(props);
    this.containerRef = createRef<HTMLDivElement>();
    this.canvasRef = createRef<HTMLCanvasElement>();
    this.state = {
      mapLoaded: false,
      error: null,
    };
    this.handleMapMove = this.handleMapMove.bind(this);
    this.handleMapZoom = this.handleMapZoom.bind(this);
  }

  async componentDidMount() {
    await this.initAMap();
  }

  componentDidUpdate(prevProps: AMapProps) {
    if (prevProps.mapStyle !== this.props.mapStyle && this.map) {
      this.map.setMapStyle(getAmapStyleUrl(this.props.mapStyle));
    }
    if (this.state.mapLoaded) {
      this.renderClusters();
    }
  }

  componentWillUnmount() {
    if (this.massMarks) {
      this.massMarks.setMap(null);
    }
    if (this.map) {
      this.map.destroy();
    }
  }

  async initAMap() {
    const { amapApiKey, amapSecurityKey, bounds, mapStyle } = this.props;

    if (!amapApiKey) {
      this.setState({ error: 'AMap API key is required' });
      return;
    }

    // Set security config if provided
    if (amapSecurityKey) {
      window._AMapSecurityConfig = {
        securityJsCode: amapSecurityKey,
      };
    }

    try {
      this.AMapSDK = await AMapLoader.load({
        key: amapApiKey,
        version: '2.0',
        plugins: ['AMap.Scale', 'AMap.ToolBar'],
      });

      if (!this.containerRef.current || !this.AMapSDK) return;

      // Calculate initial center and zoom from bounds
      const centerLng = (bounds[0][0] + bounds[1][0]) / 2;
      const centerLat = (bounds[0][1] + bounds[1][1]) / 2;

      // Estimate zoom level based on bounds
      const latDiff = Math.abs(bounds[1][1] - bounds[0][1]);
      const lngDiff = Math.abs(bounds[1][0] - bounds[0][0]);
      const maxDiff = Math.max(latDiff, lngDiff);
      const zoom = Math.max(1, Math.min(18, Math.floor(8 - Math.log2(maxDiff))));

      this.map = new this.AMapSDK.Map(this.containerRef.current, {
        zoom,
        center: [centerLng, centerLat],
        mapStyle: getAmapStyleUrl(mapStyle),
        viewMode: '2D',
      });

      // Add event listeners
      this.map.on('moveend', this.handleMapMove);
      this.map.on('zoomend', this.handleMapZoom);

      this.setState({ mapLoaded: true }, () => {
        this.renderClusters();
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load AMap';
      this.setState({ error: errorMessage });
      console.error('AMap initialization error:', e);
    }
  }

  handleMapMove() {
    if (!this.map) return;
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    this.props.onViewportChange({
      latitude: center.getLat(),
      longitude: center.getLng(),
      zoom,
    });
    this.renderClusters();
  }

  handleMapZoom() {
    if (!this.map) return;
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    this.props.onViewportChange({
      latitude: center.getLat(),
      longitude: center.getLng(),
      zoom,
    });
    this.renderClusters();
  }

  renderClusters() {
    if (!this.map || !this.canvasRef.current) return;

    const {
      clusterer,
      bounds,
      globalOpacity,
      rgb,
      pointRadius,
      pointRadiusUnit,
      hasCustomMetric,
      aggregatorName,
      width,
      height,
    } = this.props;

    const zoom = this.map.getZoom();

    // Calculate visible bounds with offset
    const offsetHorizontal = (width * 0.5) / 100;
    const offsetVertical = (height * 0.5) / 100;
    const bbox: [number, number, number, number] = [
      bounds[0][0] - offsetHorizontal,
      bounds[0][1] - offsetVertical,
      bounds[1][0] + offsetHorizontal,
      bounds[1][1] + offsetVertical,
    ];

    const clusters = clusterer.getClusters(
      bbox,
      Math.round(zoom),
    ) as ClusterFeature[];

    // Render on canvas overlay
    const canvas = this.canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = globalOpacity;

    // Get map bounds for coordinate conversion
    const mapBounds = this.map.getBounds();
    const sw = mapBounds.getSouthWest();
    const ne = mapBounds.getNorthEast();

    const lngRange = ne.getLng() - sw.getLng();
    const latRange = ne.getLat() - sw.getLat();

    clusters.forEach((cluster: ClusterFeature) => {
      const [lng, lat] = cluster.geometry.coordinates;

      // Convert lng/lat to pixel coordinates
      const x = ((lng - sw.getLng()) / lngRange) * width;
      const y = ((ne.getLat() - lat) / latRange) * height;

      if (x < -pointRadius || x > width + pointRadius || y < -pointRadius || y > height + pointRadius) {
        return;
      }

      ctx.beginPath();

      if (cluster.properties.cluster) {
        // Render cluster
        const pointCount = cluster.properties.point_count || 0;
        const clusterLabel = this.computeClusterLabel(cluster.properties, aggregatorName);
        const maxRadius = pointRadius;
        const scaledRadius = Math.max(
          10,
          Math.sqrt(pointCount / 10) * maxRadius * 0.3,
        );

        // Draw glow effect
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, scaledRadius);
        gradient.addColorStop(0, `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, 0.8)`);
        gradient.addColorStop(1, `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, 0)`);

        ctx.arc(x, y, scaledRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw label
        if (clusterLabel !== null) {
          const fontHeight = Math.max(10, scaledRadius * 0.5);
          ctx.font = `${fontHeight}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = this.getLuminance(rgb) > 110 ? 'black' : 'white';

          let labelText = String(clusterLabel);
          if (typeof clusterLabel === 'number' && clusterLabel >= 10000) {
            labelText = `${Math.round(clusterLabel / 1000)}k`;
          } else if (typeof clusterLabel === 'number' && clusterLabel >= 1000) {
            labelText = `${Math.round(clusterLabel / 100) / 10}k`;
          }

          ctx.fillText(labelText, x, y);
        }
      } else {
        // Render single point
        let radius = pointRadius / 6;
        const radiusProperty = cluster.properties.radius;
        const pointMetric = cluster.properties.metric;

        if (radiusProperty !== null && radiusProperty !== undefined) {
          radius = radiusProperty;
          if (pointRadiusUnit === 'Kilometers') {
            radius = this.kmToPixels(radius, lat, zoom);
          } else if (pointRadiusUnit === 'Miles') {
            radius = this.kmToPixels(radius * 1.60934, lat, zoom);
          }
        }

        if (!radius || radius <= 0) {
          radius = pointRadius / 6;
        }

        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`;
        ctx.fill();

        // Draw point label if has metric
        if (hasCustomMetric && pointMetric !== null && pointMetric !== undefined) {
          const fontHeight = Math.max(8, radius * 0.8);
          ctx.font = `${fontHeight}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = this.getLuminance(rgb) > 110 ? 'black' : 'white';
          ctx.fillText(String(Math.round(pointMetric * 100) / 100), x, y);
        }
      }
    });
  }

  computeClusterLabel(
    properties: ClusterProperties,
    aggregation?: string,
  ): number | null {
    const count = properties.point_count || 0;
    if (!aggregation) {
      return count;
    }
    if (aggregation === 'sum') return properties.sum ?? count;
    if (aggregation === 'min') return properties.min ?? count;
    if (aggregation === 'max') return properties.max ?? count;

    const sum = properties.sum ?? 0;
    const mean = sum / count;
    if (aggregation === 'mean') {
      return Math.round(100 * mean) / 100;
    }

    const squaredSum = properties.squaredSum ?? 0;
    const variance = squaredSum / count - mean ** 2;
    if (aggregation === 'var') {
      return Math.round(100 * variance) / 100;
    }
    if (aggregation === 'stdev' || aggregation === 'std') {
      return Math.round(100 * Math.sqrt(variance)) / 100;
    }

    return count;
  }

  getLuminance(rgb: RegExpExecArray): number {
    const r = parseInt(rgb[1], 10);
    const g = parseInt(rgb[2], 10);
    const b = parseInt(rgb[3], 10);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  kmToPixels(km: number, latitude: number, zoom: number): number {
    const earthCircumference = 40075.017;
    const latitudeRadians = (latitude * Math.PI) / 180;
    const metersPerPixel =
      (earthCircumference * Math.cos(latitudeRadians)) / (256 * 2 ** zoom);
    return (km * 1000) / metersPerPixel;
  }

  render() {
    const { width, height } = this.props;
    const { error } = this.state;

    if (error) {
      return (
        <div
          className="superset-legacy-chart-map-box"
          style={{
            width,
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
          }}
        >
          <div style={{ color: 'red', textAlign: 'center' }}>
            <p>地图加载失败</p>
            <p style={{ fontSize: '12px' }}>{error}</p>
          </div>
        </div>
      );
    }

    return (
      <div
        className="superset-legacy-chart-map-box"
        style={{ width, height, position: 'relative' }}
      >
        <div
          ref={this.containerRef}
          style={{ width: '100%', height: '100%' }}
        />
        <canvas
          ref={this.canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            width,
            height,
          }}
        />
      </div>
    );
  }
}

export default AMap;
