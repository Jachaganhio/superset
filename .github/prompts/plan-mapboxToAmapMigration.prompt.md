## Plan: 将 Superset 地图 API 从 Mapbox 完全迁移到高德地图 (AMap)

Apache Superset 当前使用 Mapbox API 为 12 种图表类型（1个 MapBox 插件 + 11个 Deck.gl 插件）提供地图底图服务。本计划将所有 Mapbox 集成完全替换为高德地图 API，移除所有 Mapbox 和 OpenStreetMap 相关代码。

### Steps

1. **替换配置系统** - 修改 `superset/config.py` 将 `MAPBOX_API_KEY` 替换为 `AMAP_API_KEY` 和 `AMAP_SECURITY_KEY`（高德需要 Web 端安全密钥），更新 `DECKGL_BASE_MAP` 默认瓦片配置为高德地图样式（标准/卫星/路网/深色/幻影黑），在 `superset-frontend/src/views/base.py` 中更新 bootstrap_data 字段名，修改 CSP 配置移除 `api.mapbox.com` 和 `events.mapbox.com`，添加 `webapi.amap.com`、`restapi.amap.com`、`*.amap.com`

2. **迁移 MapBox 图表插件到高德 JS API** - 在 `superset-frontend/plugins/legacy-plugin-chart-map-box/` 中，移除 `mapbox-gl` 和 `react-map-gl` 依赖，添加 `@amap/amap-jsapi-loader`，重写 `MapBox.tsx` 使用 `AMap.Map` 初始化地图和 `AMap.LabelsLayer` 或 `AMap.MassMarks` 实现点聚合，更新 `controlPanel.tsx` 的地图样式选项为高德预设样式（amap://styles/normal、amap://styles/dark、amap://styles/light 等）

3. **集成 Deck.gl 与高德地图底图** - 修改 `superset-frontend/plugins/legacy-preset-chart-deckgl/src/DeckGLContainer.tsx`，移除 `StaticMap` 组件和 `MAPBOX_LAYER_PREFIX` 检查，使用 `@amap/amap-jsapi-loader` 初始化高德地图实例，通过 `AMap.GLCustomLayer` 将 Deck.gl 作为自定义 WebGL 图层挂载到高德地图，确保视图同步（zoom/center/pitch/bearing）

4. **更新共享控件和工具函数** - 在 `superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Shared_DeckGL.tsx` 中，重命名 `mapboxStyle` 控件为 `amapStyle`，重写 `getDeckGLTiles()` 函数返回高德样式列表，在 `layers/spatialUtils.ts` 中将 `getMapboxApiKey()` 改为 `getAmapApiKey()`，移除 Mapbox 样式 URL 验证逻辑

5. **更新后端可视化类和数据结构** - 在 `superset/viz.py` 中，修改 `MapboxViz` 类（line 1375-1521）为 `AmapViz`，将返回的 `mapboxApiKey` 字段改为 `amapApiKey` 和 `amapSecurityKey`，更新 `BaseDeckGLViz`（line 1647）及其 11 个子类（Arc/GeoJSON/Grid/Hex/Heatmap/Polygon/Path/Scatter/Screengrid/Contour/Multi）的 payload 结构，移除 `mapbox_style` 表单字段改为 `amap_style`

6. **清理 NPM 依赖和更新文档** - 在所有 `package.json` 文件中移除 `mapbox-gl`、`react-map-gl`、`@mapbox/tiny-sdf`、`@mapbox/geojson-extent`，添加 `@amap/amap-jsapi-loader` 和 `@types/amap-js-api`，更新 `docs/docs/configuration/configuring-superset.mdx`、`docs/docs/faq.mdx`、`docs/docs/installation/docker-compose.mdx` 移除 Mapbox 说明改为高德地图 API key 和安全密钥配置指南，在 `UPDATING.md` 中添加破坏性变更警告

### Further Considerations

1. **Deck.gl 与高德地图的集成技术方案** - 推荐方案 B：使用 `AMap.GLCustomLayer` API 将 Deck.gl 作为 WebGL 自定义图层，需要同步实现视图矩阵转换；备选方案：使用高德的瓦片 URL (`https://webrd01.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}`) 配置 Deck.gl 的 TileLayer 作为底图，但会失去高德的矢量能力和样式切换

2. **高德地图 API 版本选择** - 建议使用高德地图 JS API 2.0（支持 WebGL 和 GLCustomLayer），而非 1.4.x 版本；需要确认 Deck.gl 的 WebGL 上下文是否与高德地图 2.0 兼容

3. **API 配额和企业版规划** - 高德个人开发者版日调用量 30 万次，企业版可达百万级；建议在生产环境配置企业版 API key，并在前端实现瓦片缓存或使用高德的离线地图方案

4. **地图样式映射表** - 需要建立 Mapbox 样式到高德样式的明确映射：streets → normal，dark → dark，light → light，satellite → satellite，outdoors → macaron；移除 Mapbox 独有的 satellite-streets 和 outdoors 样式

5. **测试策略和数据迁移** - 更新所有包含 `mapbox_style` 字段的现有图表元数据（数据库 migration），将样式值从 `mapbox://styles/*` 转换为高德样式标识；在 `tests/integration_tests/` 中 mock 高德 API 响应，使用 Playwright 验证所有 12 种地图图表的渲染和交互
