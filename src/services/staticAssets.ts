declare const __STATIC_ASSET_VERSION__: string

/** Content-derived version prevents stale un-hashed assets at intermediary caches. */
export const staticAssetUrl = (path: string) => {
  const version = typeof __STATIC_ASSET_VERSION__ === 'string' ? __STATIC_ASSET_VERSION__ : 'dev'
  return `${import.meta.env.BASE_URL}${path}?v=${version}`
}
