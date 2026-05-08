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

/**
 * Convert radius value from various units to meters for AMap Circle API
 * 
 * @param value - The radius value
 * @param unit - The unit type (square_m, square_km, square_miles, radius_m, radius_km, radius_miles)
 * @param multiplier - Optional multiplier to scale the radius
 * @returns Radius in meters
 */
export function computeRadius(
  value: number,
  unit: string,
  multiplier: number = 1,
): number {
  let radiusInMeters: number;
  
  switch (unit) {
    case 'square_m':
      // Convert square meters to radius in meters: r = √(area/π)
      radiusInMeters = Math.sqrt(value / Math.PI);
      break;
    case 'square_km':
      // Convert square km to radius in meters: r = √(area/π) * 1000
      radiusInMeters = Math.sqrt(value / Math.PI) * 1000;
      break;
    case 'square_miles':
      // Convert square miles to radius in meters: r = √(area/π) * 1609.34
      radiusInMeters = Math.sqrt(value / Math.PI) * 1609.34;
      break;
    case 'radius_m':
      // Direct meters
      radiusInMeters = value;
      break;
    case 'radius_km':
      // Kilometers to meters
      radiusInMeters = value * 1000;
      break;
    case 'radius_miles':
      // Miles to meters
      radiusInMeters = value * 1609.34;
      break;
    default:
      // Fallback for unknown units
      radiusInMeters = value;
      break;
  }
  
  // Apply multiplier after unit conversion (matches deck.gl behavior)
  return radiusInMeters * multiplier;
}

/**
 * Check if the unit represents a geodesic measurement (meters-based)
 * These should use AMap.Circle (geodesic)
 * 
 * @param unit - The unit type
 * @returns true if unit is geodesic, false for pixel-based
 */
export function isGeodesicUnit(unit: string): boolean {
  return [
    'square_m',
    'square_km',
    'square_miles',
    'radius_m',
    'radius_km',
    'radius_miles',
  ].includes(unit);
}

/**
 * Clamp a value between min and max
 * 
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined && result < min) {
    result = min;
  }
  if (max !== undefined && result > max) {
    result = max;
  }
  return result;
}

/**
 * Convert RGBA array to hex color string
 * 
 * @param rgba - Array of [r, g, b, a] values (0-255)
 * @returns Hex color string like '#FF0000'
 */
export function rgbaToHex(rgba: number[]): string {
  const [r, g, b] = rgba;
  return `#${[r, g, b]
    .map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    })
    .join('')}`;
}
