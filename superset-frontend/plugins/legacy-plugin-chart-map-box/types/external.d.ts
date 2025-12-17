/*
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

declare module 'supercluster' {
  export interface ClusterProperties {
    cluster?: boolean;
    cluster_id?: number;
    point_count?: number;
    point_count_abbreviated?: string | number;
  }

  export interface PointFeature<P = any> {
    type: 'Feature';
    id?: number;
    properties: P;
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
  }

  export interface ClusterFeature<P = any> extends PointFeature<P & ClusterProperties> {
    properties: P & ClusterProperties & { cluster: true };
  }

  export interface Options {
    minZoom?: number;
    maxZoom?: number;
    minPoints?: number;
    radius?: number;
    extent?: number;
    nodeSize?: number;
    log?: boolean;
    generateId?: boolean;
    reduce?: (accumulated: any, props: any) => void;
    map?: (props: any) => any;
  }

  export default class Supercluster<P = any, C = any> {
    constructor(options?: Options);
    load(points: Array<PointFeature<P>>): this;
    getClusters(bbox: [number, number, number, number], zoom: number): Array<ClusterFeature<C> | PointFeature<P>>;
    getChildren(clusterId: number): Array<ClusterFeature<C> | PointFeature<P>>;
    getLeaves(clusterId: number, limit?: number, offset?: number): Array<PointFeature<P>>;
    getTile(z: number, x: number, y: number): any;
    getClusterExpansionZoom(clusterId: number): number;
  }
}
