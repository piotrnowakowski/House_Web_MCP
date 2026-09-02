export default {
  testDir: './tests',
  timeout: 90_000,
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 120_000 },
  use: { channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 } },
  reporter: 'line',
}
