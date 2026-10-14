import config from './playwright.interior.config'

export default {
  ...config,
  testMatch: 'mobile-changes.spec.ts',
  use: { ...config.use, channel: undefined, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
}
