/* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/forbid-prop-types */
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
import {
  forwardRef,
  memo,
  ReactNode,
  MouseEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  useRef,
} from 'react';
import { isEqual } from 'lodash';
import DeckGL from '@deck.gl/react';
import type { Layer } from '@deck.gl/core';
import { JsonObject, JsonValue, styled, usePrevious } from '@superset-ui/core';
import Tooltip, { TooltipProps } from './components/Tooltip';
import AMapLoader from '@amap/amap-jsapi-loader';
import { Viewport } from './utils/fitViewport';
import {
  AMAP_LAYER_PREFIX,
  TILE_LAYER_PREFIX,
  buildTileLayer,
} from './utils';

const TICK = 250; // milliseconds

export type DeckGLContainerProps = {
  viewport: Viewport;
  setControlValue?: (control: string, value: JsonValue) => void;
  mapStyle?: string;
  amapApiKey: string;
  amapSecurityKey?: string;
  children?: ReactNode;
  width: number;
  height: number;
  layers: (Layer | (() => Layer))[];
  onViewportChange?: (viewport: Viewport) => void;
};

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [viewState, setViewState] = useState(props.viewport);
    const prevViewport = usePrevious(props.viewport);
    const glContextRef = useRef<WebGL2RenderingContext | null>(null);
    const amapContainerRef = useRef<HTMLDivElement | null>(null);
    const amapInstanceRef = useRef<any>(null);
    const [amapLoaded, setAmapLoaded] = useState(false);

    // Initialize AMap
    useEffect(() => {
      if (!props.mapStyle?.startsWith(AMAP_LAYER_PREFIX) || amapInstanceRef.current) {
        return;
      }

      const initAMap = async () => {
        try {
          // Set security config
          if (props.amapSecurityKey) {
            (window as any)._AMapSecurityConfig = {
              securityJsCode: props.amapSecurityKey,
            };
          }

          const AMap = await AMapLoader.load({
            key: props.amapApiKey,
            version: '2.0',
            plugins: ['AMap.Scale', 'AMap.ToolBar'],
          });

          if (amapContainerRef.current && !amapInstanceRef.current) {
            const styleUrl = props.mapStyle?.replace(AMAP_LAYER_PREFIX, '') || 'normal';
            amapInstanceRef.current = new AMap.Map(amapContainerRef.current, {
              zoom: viewState.zoom + 1,
              center: [viewState.longitude, viewState.latitude],
              pitch: viewState.pitch || 0,
              rotation: -(viewState.bearing || 0),
              mapStyle: `amap://styles/${styleUrl}`,
              viewMode: '3D',
            });
            setAmapLoaded(true);
          }
        } catch (error) {
          console.error('Failed to load AMap:', error);
        }
      };

      initAMap();

      return () => {
        if (amapInstanceRef.current) {
          amapInstanceRef.current.destroy();
          amapInstanceRef.current = null;
        }
      };
    }, [props.amapApiKey, props.amapSecurityKey, props.mapStyle]);

    // Sync AMap view with DeckGL viewState
    useEffect(() => {
      if (amapInstanceRef.current && amapLoaded) {
        amapInstanceRef.current.setZoomAndCenter(
          viewState.zoom + 1,
          [viewState.longitude, viewState.latitude],
        );
        amapInstanceRef.current.setPitch(viewState.pitch || 0);
        amapInstanceRef.current.setRotation(-(viewState.bearing || 0));
      }
    }, [viewState, amapLoaded]);

    useEffect(
      () => () => {
        glContextRef.current?.getExtension('WEBGL_lose_context')?.loseContext();
      },
      [],
    );

    useImperativeHandle(ref, () => ({ setTooltip }), []);

    const tick = useCallback(() => {
      // Rate limiting updating viewport controls as it triggers lots of renders
      if (lastUpdate && Date.now() - lastUpdate > TICK) {
        const setCV = props.setControlValue;
        if (setCV) {
          setCV('viewport', viewState);
        }
        setLastUpdate(null);
      }
    }, [lastUpdate, props.setControlValue, viewState]);

    useEffect(() => {
      const timer = setInterval(tick, TICK);
      return () => clearInterval(timer);
    }, [tick]);

    useEffect(() => {
      if (!isEqual(props.viewport, prevViewport)) {
        setViewState(props.viewport);
      }
    }, [prevViewport, props.viewport]);

    const onViewStateChange = useCallback(
      ({ viewState }: { viewState: JsonObject }) => {
        setViewState(viewState as Viewport);
        setLastUpdate(Date.now());
      },
      [],
    );

    const layers = useCallback(() => {
      if (
        props.mapStyle?.startsWith(TILE_LAYER_PREFIX) &&
        props.layers.some(
          l => typeof l !== 'function' && l?.id === 'tile-layer',
        ) === false
      ) {
        props.layers.unshift(
          buildTileLayer(
            (props.mapStyle ?? '').replace(TILE_LAYER_PREFIX, ''),
            'tile-layer',
          ),
        );
      }
      // Support for layer factory
      if (props.layers.some(l => typeof l === 'function')) {
        return props.layers.map(l =>
          typeof l === 'function' ? l() : l,
        ) as Layer[];
      }

      return props.layers as Layer[];
    }, [props.layers, props.mapStyle]);

    const { children = null, height, width } = props;

    const isAmapStyle = props.mapStyle?.startsWith(AMAP_LAYER_PREFIX);

    return (
      <>
        <div
          style={{ position: 'relative', width, height }}
          onContextMenu={(e: MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* AMap base map container */}
          {isAmapStyle && (
            <div
              ref={amapContainerRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width,
                height,
                zIndex: 0,
              }}
            />
          )}
          {/* DeckGL overlay */}
          <DeckGL
            controller
            width={width}
            height={height}
            layers={layers()}
            viewState={viewState}
            onViewStateChange={onViewStateChange}
            onAfterRender={context => {
              glContextRef.current = context.gl;
            }}
            style={{
              position: isAmapStyle ? 'absolute' : 'relative',
              top: '0',
              left: '0',
              zIndex: (isAmapStyle ? 1 : 0) as any,
              background: isAmapStyle ? 'transparent' : undefined,
            }}
          />
          {children}
        </div>
        <Tooltip tooltip={tooltip} />
      </>
    );
  }),
);

export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
  .deckgl-tooltip > div {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export type DeckGLContainerHandle = typeof DeckGLContainer & {
  setTooltip: (tooltip: ReactNode) => void;
};
