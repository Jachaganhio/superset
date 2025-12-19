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
import { JsonObject, QueryFormData, t, CategoricalColorNamespace } from '@superset-ui/core';
import { isPointInBonds } from '../../utilities/utils';
import TooltipRow from '../../TooltipRow';
import { HIGHLIGHT_COLOR_ARRAY } from '../../utils';
import { hexToRGB } from '../../utils/colors';
import Legend from '../../components/Legend';
import {
  AMapSDK,
  AMapMapInstance,
  AMapCircleInstance,
  AMapCircleMarkerInstance,
  AMapScatterPoint,
} from './amapTypes';
import {
  computeRadius,
  isGeodesicUnit,
  clamp,
  rgbaToHex,
} from './amapUtils';

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
  }
}

interface ScatterAMapProps {
  formData: QueryFormData;
  payload: {
    data: {
      features: AMapScatterPoint[];
      amapApiKey?: string;
      amapSecurityKey?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  setTooltip?: (tooltip: any) => void;
  height: number;
  width: number;
  filterState?: {
    value?: any;
  };
  onContextMenu?: (e: MouseEvent) => void;
  emitCrossFilters?: (filters: any) => void;
  datasource?: any;
  [key: string]: any;
}

interface ScatterAMapState {
  mapLoaded: boolean;
  error: string | null;
  categories: Record<string, { color: any; enabled: boolean }>;
}

function getMetricLabel(metric: any): string {
  if (typeof metric === 'string') {
    return metric;
  }
  if (metric?.label) {
    return metric.label;
  }
  if (metric?.verbose_name) {
    return metric.verbose_name;
  }
  return metric?.value || 'Metric';
}

const NOOP = () => {};

const getAmapStyleUrl = (style: string): string => {
  if (!style || style.startsWith('mapbox://')) {
    return 'amap://styles/normal';
  }
  if (style.startsWith('amap://')) {
    return style;
  }
  return `amap://styles/${style}`;
};

class ScatterAMap extends Component<ScatterAMapProps, ScatterAMapState> {
  private containerRef: RefObject<HTMLDivElement>;

  private map: AMapMapInstance | null = null;

  private AMapSDK: AMapSDK | null = null;

  private overlays: Array<AMapCircleInstance | AMapCircleMarkerInstance> = [];

  private highlightOverlays: Array<
    AMapCircleInstance | AMapCircleMarkerInstance
  > = [];

  constructor(props: ScatterAMapProps) {
    super(props);
    this.containerRef = createRef<HTMLDivElement>();
    this.state = {
      mapLoaded: false,
      error: null,
      categories: {},
    };
  }

  async componentDidMount() {
    await this.initAMap();
  }

  componentDidUpdate(prevProps: ScatterAMapProps) {
    if (
      this.state.mapLoaded &&
      (prevProps.payload !== this.props.payload ||
        prevProps.filterState !== this.props.filterState)
    ) {
      this.renderPoints();
    }
  }

  componentWillUnmount() {
    this.clearOverlays();
    this.clearHighlightOverlays();
    if (this.map) {
      this.map.destroy();
    }
  }

  async initAMap() {
    const { formData, payload } = this.props;
    const { amap_style, mapbox_style } = formData;
    const mapStyle = amap_style || mapbox_style;

    // Get API keys from payload or formData
    const amapApiKey = payload?.data?.amapApiKey || payload?.amapApiKey || formData?.amap_api_key;
    const amapSecurityKey = payload?.data?.amapSecurityKey || payload?.amapSecurityKey || formData?.amap_security_key;

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
      this.AMapSDK = (await AMapLoader.load({
        key: amapApiKey,
        version: '2.0',
        plugins: ['AMap.Circle', 'AMap.CircleMarker'],
      })) as unknown as AMapSDK;

      if (!this.containerRef.current || !this.AMapSDK) return;

      // Calculate bounds from features
      const features = payload?.data?.features || [];
      if (features.length === 0) {
        this.setState({ error: 'No data to display' });
        return;
      }

      const lngs = features.map((f: AMapScatterPoint) => f.position[0]);
      const lats = features.map((f: AMapScatterPoint) => f.position[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;

      // Estimate zoom level based on bounds
      const latDiff = Math.abs(maxLat - minLat);
      const lngDiff = Math.abs(maxLng - minLng);
      const maxDiff = Math.max(latDiff, lngDiff);
      const zoom = Math.max(
        1,
        Math.min(18, Math.floor(8 - Math.log2(maxDiff))),
      );

      this.map = new this.AMapSDK.Map(this.containerRef.current, {
        zoom,
        center: [centerLng, centerLat],
        mapStyle: getAmapStyleUrl(mapStyle as string),
        viewMode: '2D',
      });

      this.setState({ mapLoaded: true }, () => {
        this.renderPoints();
      });
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : 'Failed to load AMap';
      this.setState({ error: errorMessage });
      console.error('AMap initialization error:', e);
    }
  }

  private clearOverlays() {
    if (this.overlays.length) {
      this.overlays.forEach(ov => {
        try {
          ov.setMap(null);
        } catch (e) {
          // ignore
        }
      });
      this.overlays = [];
    }
  }

  private clearHighlightOverlays() {
    if (this.highlightOverlays.length) {
      this.highlightOverlays.forEach(ov => {
        try {
          ov.setMap(null);
        } catch (e) {
          // ignore
        }
      });
      this.highlightOverlays = [];
    }
  }

  private renderPoints() {
    if (!this.map || !this.AMapSDK) return;

    const { formData, payload, setTooltip, filterState, emitCrossFilters } =
      this.props;
    const fd = formData;
    const features = payload?.data?.features || [];

    // Clear existing overlays
    this.clearOverlays();
    this.clearHighlightOverlays();

    // Get color from form data
    const defaultColor = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const defaultColorArray = [
      defaultColor.r,
      defaultColor.g,
      defaultColor.b,
      defaultColor.a * 255,
    ];

    // Set up categorical color function if dimension is set
    const { getScale } = CategoricalColorNamespace;
    const colorFn = fd.dimension ? getScale(fd.color_scheme) : null;

    // Build categories for legend
    const newCategories: Record<string, { color: any; enabled: boolean }> = {};
    if (fd.dimension) {
      features.forEach((feature: AMapScatterPoint) => {
        if (feature.cat_color != null && !newCategories.hasOwnProperty(feature.cat_color)) {
          const color = hexToRGB(colorFn!(feature.cat_color, fd.sliceId), defaultColor.a * 255);
          newCategories[feature.cat_color] = { color, enabled: this.state.categories[feature.cat_color]?.enabled ?? true };
        }
      });
    }
    
    // Update categories state if changed
    if (JSON.stringify(Object.keys(newCategories).sort()) !== JSON.stringify(Object.keys(this.state.categories).sort())) {
      this.setState({ categories: newCategories });
    }

    // Determine if we should use geodesic (Circle) or pixel (CircleMarker) radius
    const useGeodesic = isGeodesicUnit(fd.point_unit);

    // Opacity for filtered state
    const opacity = filterState?.value ? 0.3 : 1;

    // Get multiplier from form data
    const multiplier = fd.multiplier || 1;

    // Get radius value: use point_radius_fixed.value for fixed mode, or feature.radius for metric mode
    const fixedRadius = fd.point_radius_fixed?.type === 'fix' && fd.point_radius_fixed?.value
      ? Number(fd.point_radius_fixed.value)
      : null;

    features.forEach((feature: AMapScatterPoint) => {
      const [lng, lat] = feature.position;
      
      // Skip features with disabled categories (enabled defaults to true if not set)
      if (fd.dimension && feature.cat_color && this.state.categories[feature.cat_color]?.enabled === false) {
        return;
      }
      
      // Apply categorical colors if dimension is set, otherwise use feature color or default
      let color: number[];
      if (fd.dimension && feature.cat_color && colorFn) {
        color = hexToRGB(colorFn(feature.cat_color, fd.sliceId), defaultColor.a * 255);
      } else if (feature.color) {
        color = feature.color;
      } else {
        color = defaultColorArray;
      }
      
      const fillColor = rgbaToHex(color);
      const fillOpacity = (color[3] / 255) * opacity;

      let overlay: AMapCircleInstance | AMapCircleMarkerInstance;
      let radius = fixedRadius !== null ? fixedRadius : (feature.radius || 10);

      if (useGeodesic) {
        // Use Circle for geodesic radius (meters)
        const radiusMeters = computeRadius(
          radius,
          fd.point_unit,
          multiplier,
        );

        // Debug: log first feature
        if (features.indexOf(feature) === 0) {
          console.log('AMap Circle Debug:', {
            featureRadius: feature.radius,
            pointUnit: fd.point_unit,
            multiplier,
            computedRadiusMeters: radiusMeters,
            color: feature.color,
            fillColor,
            catColor: feature.cat_color,
          });
        }

        overlay = new this.AMapSDK!.Circle({
          center: [lng, lat],
          radius: radiusMeters,
          fillColor,
          fillOpacity,
          strokeColor: fillColor,
          strokeOpacity: Math.min(fillOpacity * 1.5, 1),
          strokeWeight: 1,
          zIndex: 10,
          extData: feature,
        });
      } else {
        // Use CircleMarker for pixel radius with multiplier applied
        const radiusPixels = clamp(
          radius * multiplier,
          fd.min_radius,
          fd.max_radius,
        );

        overlay = new this.AMapSDK!.CircleMarker({
          center: [lng, lat],
          radius: radiusPixels,
          fillColor,
          fillOpacity,
          strokeColor: fillColor,
          strokeOpacity: Math.min(fillOpacity * 1.5, 1),
          strokeWeight: 1,
          zIndex: 10,
          extData: feature,
        });
      }

      // Add hover tooltip
      if (setTooltip) {
        overlay.on('mouseover', (e: any) => {
          const data = overlay.getExtData();
          const metricLabel = getMetricLabel(fd.point_radius_fixed?.value);

          setTooltip({
            x: e.pixel?.x || 0,
            y: e.pixel?.y || 0,
            content: (
              <div className="deckgl-tooltip">
                <TooltipRow
                  label={`${t('Longitude and Latitude')}: `}
                  value={`${data.position[0]}, ${data.position[1]}`}
                />
                {data.cat_color && (
                  <TooltipRow
                    label={`${t('Category')}: `}
                    value={`${data.cat_color}`}
                  />
                )}
                {data.metric !== undefined && (
                  <TooltipRow label={`${metricLabel}: `} value={`${data.metric}`} />
                )}
              </div>
            ),
          });
        });

        overlay.on('mouseout', () => {
          setTooltip(null);
        });
      }

      // Add click handler for cross-filtering
      if (emitCrossFilters) {
        overlay.on('click', () => {
          const data = overlay.getExtData();
          emitCrossFilters({
            dataMask: {
              extraFormData: {},
              filterState: {
                value: [data],
                selectedValues: [],
              },
            },
          });
        });
      }

      overlay.setMap(this.map);
      this.overlays.push(overlay);
    });

    // Render highlight layer if filter is active
    if (filterState?.value) {
      this.renderHighlightLayer();
    }
  }

  private renderHighlightLayer() {
    if (!this.map || !this.AMapSDK) return;

    const { formData, payload, filterState } = this.props;
    const fd = formData;
    const features = payload?.data?.features || [];

    // Filter points inside the bounds
    const dataInside = features.filter((f: AMapScatterPoint) =>
      isPointInBonds(f.position, filterState?.value),
    );

    const useGeodesic = isGeodesicUnit(fd.point_unit);
    const highlightColor = rgbaToHex(HIGHLIGHT_COLOR_ARRAY);
    const highlightOpacity = HIGHLIGHT_COLOR_ARRAY[3] / 255;

    dataInside.forEach((feature: AMapScatterPoint) => {
      const [lng, lat] = feature.position;

      let overlay: AMapCircleInstance | AMapCircleMarkerInstance;

      if (useGeodesic) {
        const radiusMeters = computeRadius(
          feature.radius || 10,
          fd.point_unit,
          fd.multiplier,
        );

        overlay = new this.AMapSDK!.Circle({
          center: [lng, lat],
          radius: radiusMeters,
          fillColor: highlightColor,
          fillOpacity: highlightOpacity,
          strokeColor: highlightColor,
          strokeOpacity: 1,
          strokeWeight: 2,
          zIndex: 20,
          extData: feature,
        });
      } else {
        const radiusPixels = clamp(
          feature.radius || 10,
          fd.min_radius,
          fd.max_radius,
        );

        overlay = new this.AMapSDK!.CircleMarker({
          center: [lng, lat],
          radius: radiusPixels,
          fillColor: highlightColor,
          fillOpacity: highlightOpacity,
          strokeColor: highlightColor,
          strokeOpacity: 1,
          strokeWeight: 2,
          zIndex: 20,
          extData: feature,
        });
      }

      overlay.setMap(this.map);
      this.highlightOverlays.push(overlay);
    });
  }

  private toggleCategory = (category: string) => {
    this.setState(
      prevState => ({
        categories: {
          ...prevState.categories,
          [category]: {
            ...prevState.categories[category],
            enabled: !prevState.categories[category].enabled,
          },
        },
      }),
      () => {
        this.renderPoints();
      },
    );
  };

  private showSingleCategory = (category: string) => {
    this.setState(
      prevState => {
        const newCategories = { ...prevState.categories };
        Object.keys(newCategories).forEach(key => {
          newCategories[key] = {
            ...newCategories[key],
            enabled: key === category,
          };
        });
        return { categories: newCategories };
      },
      () => {
        this.renderPoints();
      },
    );
  };

  render() {
    const { width, height, formData } = this.props;
    const { error, categories } = this.state;

    if (error) {
      return (
        <div
          style={{
            width,
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
          }}
        >
          <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', width, height }}>
        <div
          ref={this.containerRef}
          style={{ width, height }}
          className="amap-container"
        />
        {formData.dimension && Object.keys(categories).length > 0 && (
          <Legend
            forceCategorical
            categories={categories}
            format={formData.legend_format}
            position={formData.legend_position}
            toggleCategory={this.toggleCategory}
            showSingleCategory={this.showSingleCategory}
          />
        )}
      </div>
    );
  }
}

export default ScatterAMap;
