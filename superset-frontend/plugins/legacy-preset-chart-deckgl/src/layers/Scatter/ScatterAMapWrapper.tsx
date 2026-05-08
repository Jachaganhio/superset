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
import { ChartProps, QueryFormData } from '@superset-ui/core';
import { AMapScatterPoint } from './amapTypes';
import ScatterAMap from './ScatterAMap';

/**
 * Wrapper component that converts ChartProps format to ScatterAMap props format
 * This allows ScatterAMap to work with the standard Superset chart plugin interface
 */
function ScatterAMapWrapper(chartProps: ChartProps<QueryFormData>) {
  const {
    formData,
    height,
    width,
    filterState,
    hooks,
    datasource,
    emitCrossFilters,
  } = chartProps;

  type TransformedScatterChartProps = ChartProps<QueryFormData> & {
    payload?: {
      data?: {
        features?: AMapScatterPoint[];
        amapApiKey?: string;
        amapSecurityKey?: string;
      };
    };
  };

  // Extract the transformed props (these come from transformProps)
  const transformedProps = chartProps as TransformedScatterChartProps;
  
  // Prepare payload in the format ScatterAMap expects
  const payload = {
    data: {
      features: transformedProps.payload?.data?.features || [],
      amapApiKey: transformedProps.payload?.data?.amapApiKey,
      amapSecurityKey: transformedProps.payload?.data?.amapSecurityKey,
    },
  };

  const typedFormData = formData as unknown as QueryFormData;

  return (
    <ScatterAMap
      formData={typedFormData}
      payload={payload}
      height={height}
      width={width}
      filterState={filterState}
      onContextMenu={hooks?.onContextMenu}
      emitCrossFilters={emitCrossFilters}
      setDataMask={hooks?.setDataMask}
      setTooltip={hooks?.setTooltip}
      datasource={datasource}
    />
  );
}

export default ScatterAMapWrapper;
