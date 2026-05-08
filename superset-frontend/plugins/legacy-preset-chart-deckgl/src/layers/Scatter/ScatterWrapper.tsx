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
import { lazy, Suspense } from 'react';

const DeckGLScatter = lazy(() => import('./Scatter'));
const AMapScatterWrapper = lazy(() => import('./ScatterAMapWrapper'));

function shouldUseAMap(mapStyle?: string, amapStyle?: string): boolean {
  // Use AMap if amap_style is set or mapbox_style starts with 'amap://'
  if (amapStyle && amapStyle.startsWith('amap://')) return true;
  if (mapStyle && mapStyle.startsWith('amap://')) return true;
  return false;
}

function ScatterWrapper(props: Record<string, any>) {
  const { formData } = props;
  const useAMap = shouldUseAMap(formData?.mapbox_style, formData?.amap_style);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {useAMap ? <AMapScatterWrapper {...(props as any)} /> : <DeckGLScatter {...(props as any)} />}
    </Suspense>
  );
}

export default ScatterWrapper;
