import { Html, useGLTF } from '@react-three/drei'
import { Component, Suspense, useMemo, useState, type ReactNode } from 'react'
import type { Mesh } from 'three'
import { ikeaProduct } from '../domain/ikeaCatalog'
import type { InteriorItem } from '../domain/types'
import { FurnitureModel } from './FurnitureModel'

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function LoadedProduct({ url }: { url: string }) {
  const gltf = useGLTF(url)
  const scene = useMemo(() => {
    const result = gltf.scene.clone(true)
    result.traverse((object) => {
      if ((object as Mesh).isMesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    return result
  }, [gltf.scene])
  return <primitive object={scene} dispose={null} />
}

function FootprintFallback({ item, failed, onRetry }: { item: InteriorItem; failed?: boolean; onRetry?: () => void }) {
  return (
    <>
      <mesh position={[0, item.heightM / 2, 0]}>
        <boxGeometry args={[item.widthM, item.heightM, item.depthM]} />
        <meshStandardMaterial color={item.color} transparent opacity={0.45} wireframe />
      </mesh>
      {failed && (
        <Html center position={[0, item.heightM + 0.1, 0]} zIndexRange={[9, 0]}>
          <button
            className="model-retry"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onRetry?.()
            }}
          >
            Model unavailable · Retry
          </button>
        </Html>
      )}
    </>
  )
}

/** Cached GLBs share geometry/textures; failures stay selectable with true physical bounds. */
export function ProductModel({ item, mobile = false }: { item: InteriorItem; mobile?: boolean }) {
  const [attempt, setAttempt] = useState(0)
  const product = ikeaProduct(item.productId)
  if (!product) return <FurnitureModel item={item} />
  const url = `${import.meta.env.BASE_URL}${mobile ? product.mobileModel : product.model}`
  return (
    <ModelBoundary
      key={`${url}/${attempt}`}
      fallback={
        <FootprintFallback
          item={item}
          failed
          onRetry={() => {
            useGLTF.clear(url)
            setAttempt((value) => value + 1)
          }}
        />
      }
    >
      <Suspense fallback={<FootprintFallback item={item} />}>
        <group
          name={`interior-product/${item.ref}`}
          scale={[item.widthM / product.size[0], item.heightM / product.size[2], item.depthM / product.size[1]]}
        >
          <LoadedProduct url={url} />
        </group>
      </Suspense>
    </ModelBoundary>
  )
}
