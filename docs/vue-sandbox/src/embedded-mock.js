export async function embedDashboard(options = {}) {
  const { mountPoint } = options;
  const container = mountPoint || (typeof document !== 'undefined' && document.createElement('div'));
  if (container) {
    container.innerHTML = `
      <div style="padding:24px; font-family: system-ui, sans-serif;">
        <h3 style="margin:0 0 8px">[Mock] Embedded Dashboard</h3>
        <p style="margin:0;color:#555">This is a mock embed to allow local UI testing without external SDKs.</p>
      </div>
    `;
  }
  return Promise.resolve();
}

export default { embedDashboard };
