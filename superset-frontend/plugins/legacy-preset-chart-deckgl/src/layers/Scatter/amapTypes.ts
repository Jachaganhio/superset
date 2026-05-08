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

export interface AMapMapInstance {
  add: (overlays: any | any[]) => void;
  remove: (overlays: any | any[]) => void;
  destroy: () => void;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number;
  getCenter: () => { lng: number; lat: number };
  on: (event: string, handler: (e: any) => void) => void;
  off: (event: string, handler: (e: any) => void) => void;
}

export interface AMapCircleOptions {
  center: [number, number];
  radius: number; // meters
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  zIndex?: number;
  extData?: any;
}

export interface AMapCircleMarkerOptions {
  center: [number, number];
  radius: number; // pixels
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  zIndex?: number;
  extData?: any;
}

export interface AMapCircleInstance {
  setMap: (map: AMapMapInstance | null) => void;
  on: (event: string, handler: (e: any) => void) => void;
  off: (event: string, handler: (e: any) => void) => void;
  getExtData: () => any;
  setOptions: (options: Partial<AMapCircleOptions>) => void;
  getOptions: () => AMapCircleOptions;
}

export interface AMapCircleMarkerInstance {
  setMap: (map: AMapMapInstance | null) => void;
  on: (event: string, handler: (e: any) => void) => void;
  off: (event: string, handler: (e: any) => void) => void;
  getExtData: () => any;
  setOptions: (options: Partial<AMapCircleMarkerOptions>) => void;
  getOptions: () => AMapCircleMarkerOptions;
}

export interface AMapTextOptions {
  text: string;
  position: [number, number];
  offset?: [number, number];
  anchor?: string;
  style?: {
    color?: string;
    fontSize?: number;
    fontWeight?: string | number;
    backgroundColor?: string;
    padding?: string;
    borderRadius?: number;
  };
  zIndex?: number;
  extData?: any;
}

export interface AMapTextInstance {
  setMap: (map: AMapMapInstance | null) => void;
  on: (event: string, handler: (e: any) => void) => void;
  off: (event: string, handler: (e: any) => void) => void;
  getExtData: () => any;
  setText: (text: string) => void;
}

export interface AMapSDK {
  Map: new (container: string | HTMLDivElement, options: any) => AMapMapInstance;
  Circle: new (options: AMapCircleOptions) => AMapCircleInstance;
  CircleMarker: new (options: AMapCircleMarkerOptions) => AMapCircleMarkerInstance;
  Text: new (options: AMapTextOptions) => AMapTextInstance;
}

export interface AMapScatterPoint {
  position: [number, number];
  radius?: number;
  color: [number, number, number, number];
  cat_color?: string;
  metric?: number;
  extraProps?: Record<string, unknown>;
}
