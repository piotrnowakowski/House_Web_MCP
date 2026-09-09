import products from './ikea-products.json'
import type { InteriorCatalogId, InteriorItem, Vec2 } from './types'

export type IkeaProduct = Omit<(typeof products)[number], 'catalogId' | 'size'> & {
  catalogId: InteriorCatalogId
  size: [number, number, number]
}
export const ikeaCatalog = products as IkeaProduct[]
export const ikeaProduct = (id?: string) => ikeaCatalog.find((product) => product.id === id)

export function createIkeaItem(productId: string, storeyRef: string, position: Vec2): InteriorItem {
  const product = ikeaProduct(productId)
  if (!product) throw new Error('This product is not in the furniture library.')
  return {
    ref: `interior/${crypto.randomUUID()}`,
    catalogId: product.catalogId,
    productId,
    variantId: product.articleNumber,
    name: `${product.family} ${product.name}`,
    storeyRef,
    position,
    widthM: product.size[0],
    depthM: product.size[1],
    heightM: product.size[2],
    rotationDegrees: 0,
    elevationM: product.elevationM,
    color: product.color,
  }
}
