import config from './playwright.config'

const url = process.env.APP_URL ?? 'http://127.0.0.1:5187'
export default {
  ...config,
  workers: 1,
  webServer: {
    ...config.webServer,
    command: `npm run dev -- --host 127.0.0.1 --port ${new URL(url).port || '5187'} --strictPort`,
    url,
  },
}
