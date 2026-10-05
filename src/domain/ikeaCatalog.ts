import { randomId } from './randomId'
import products from './ikea-products.json'
import type { InteriorCatalogId, InteriorItem, Vec2 } from './types'

export type IkeaProduct = Omit<(typeof products)[number], 'catalogId' | 'size'> & {
  catalogId: InteriorCatalogId
  size: [number, number, number]
}
export const ikeaCatalog = products as IkeaProduct[]
export const ikeaProduct = (id?: string) => ikeaCatalog.find((product) => product.id === id)

export function ikeaHeightVariants(id?: string) {
  const group = ikeaProduct(id)?.heightGroup
  return group ? ikeaCatalog.filter((product) => product.heightGroup === group).sort((a, b) => a.size[2] - b.size[2]) : []
}

/** Switch to a real IKEA assembly while retaining placement, grouping and custom names. */
export function withIkeaHeightVariant(item: InteriorItem, productId: string): InteriorItem {
  const product = ikeaHeightVariants(item.productId).find((entry) => entry.id === productId)
  if (!product) throw new Error('Choose a height variant of this furniture configuration.')
  const previous = ikeaProduct(item.productId)!
  return {
    ...item,
    productId,
    variantId: product.articleNumber,
    catalogId: product.catalogId,
    name: item.name === `${previous.family} ${previous.name}` ? `${product.family} ${product.name}` : item.name,
    widthM: product.size[0],
    depthM: product.size[1],
    heightM: product.size[2],
    color: product.color,
  }
}

export function createIkeaItem(productId: string, storeyRef: string, position: Vec2): InteriorItem {
  const product = ikeaProduct(productId)
  if (!product) throw new Error('This product is not in the furniture library.')
  return {
    ref: `interior/${randomId()}`,
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
