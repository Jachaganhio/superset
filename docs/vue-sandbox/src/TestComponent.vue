<template>
  <section class="data-dashboard">
    <header class="dashboard-header">
      <div>
        <h3>数据看板</h3>
        <p>来自 Superset 的关键指标与趋势图表。</p>
      </div>
      <button
        type="button"
        class="dashboard-tag"
        :class="{ refreshing: isRefreshing }"
        :disabled="isRefreshing"
        @click="refreshCharts"
      >
        {{ isRefreshing ? '刷新中...' : '实时同步' }}
      </button>
    </header>

    <div class="dashboard-embed">
      <div ref="dashboardMount" class="dashboard-mount"></div>
      <div v-if="status !== 'ready'" class="frame-overlay">
        <span>{{ getStatusText(status) }}</span>
      </div>
    </div>

    <p class="dashboard-footer">
      访问
      <a :href="dashboardUrl" target="_blank" rel="noopener noreferrer">看板页面</a>
      查看详情
    </p>
  </section>
</template>

<script setup>
import { embedDashboard } from '@superset-ui/embedded-sdk'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const timeoutMs = 12000
const supersetDomain = 'http://172.23.100.207:8088'
const embeddedDashboardId = '0ae1a08b-57d8-4e7f-b559-419d415631f5'
// const dashboardUuid = '0413029d-a5bd-4b9e-9fc5-abf1e8e930ec'
const dashboardNumericId = '2'
const dashboardUrl = `${supersetDomain}/superset/dashboard/${dashboardNumericId}/?native_filters_key=`

const isRefreshing = ref(false)
const status = ref('loading')
const dashboardMount = ref(null)
let loadTimeoutId = null

async function fetchGuestToken() {
  return "test-guest-token" // Replace with actual token fetching logic;
}

function clearLoadTimeout() {
  if (loadTimeoutId) {
    clearTimeout(loadTimeoutId)
    loadTimeoutId = null
  }
}

function startLoadTimeout() {
  clearLoadTimeout()
  loadTimeoutId = setTimeout(() => {
    if (status.value === 'loading') {
      status.value = 'timeout'
      isRefreshing.value = false
    }
  }, timeoutMs)
}

function getStatusText(currentStatus) {
  if (currentStatus === 'timeout') {
    return '加载超时，请刷新页面或前往看板页面查看'
  }
  if (currentStatus === 'error') {
    return '加载失败，请刷新页面或前往看板页面查看'
  }
  return '加载中...'
}

async function loadDashboard() {
  if (!dashboardMount.value || isRefreshing.value) {
    return
  }

  isRefreshing.value = true
  status.value = 'loading'
  dashboardMount.value.innerHTML = ''
  startLoadTimeout()

  try {
    await embedDashboard({
      id: embeddedDashboardId,
      supersetDomain,
      mountPoint: dashboardMount.value,
      fetchGuestToken,
      dashboardUiConfig: {
        hideTitle: true,
        filters: { expanded: false }
      }
    })
    status.value = 'ready'
  } catch (error) {
    console.error(error)
    status.value = 'error'
  } finally {
    clearLoadTimeout()
    isRefreshing.value = false
  }
}

function refreshCharts() {
  loadDashboard()
}

onMounted(() => {
  loadDashboard()
})

onBeforeUnmount(() => {
  clearLoadTimeout()
})
</script>

<style scoped>
.data-dashboard {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-header h3 {
  margin: 0;
  font-size: 22px;
}

.dashboard-header p {
  margin: 6px 0 0;
  color: rgba(23, 50, 74, 0.7);
}

.dashboard-tag {
  border: none;
  cursor: pointer;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s ease, opacity 0.2s ease;
}

.dashboard-tag:hover {
  background: rgba(59, 130, 246, 0.2);
}

.dashboard-tag.refreshing,
.dashboard-tag:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.dashboard-embed {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 16px 30px rgba(15, 45, 66, 0.08);
}

.dashboard-mount {
  min-height: 600px;
}

.frame-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(243, 248, 255, 0.96));
  color: #1f3c63;
  font-weight: 600;
  text-align: center;
  padding: 20px;
}

.dashboard-footer {
  text-align: center;
  margin: 8px 0 0;
  color: rgba(23, 50, 74, 0.7);
}

.dashboard-footer a {
  color: #1d4ed8;
  text-decoration: none;
  font-weight: 600;
}

.dashboard-footer a:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
