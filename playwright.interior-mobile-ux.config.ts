import config from './playwright.interior.config'

export default {
  ...config,
  testMatch: 'interior-mobile-ux.spec.ts',
  use: { ...config.use, channel: undefined, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
}
