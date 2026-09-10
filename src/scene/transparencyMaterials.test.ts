import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { fadeMesh, transparencyRef } from './transparencyMaterials'

describe('temporary object transparency', () => {
  it('isolates shared materials and restores their current finish and shadows', () => {
    const source = new MeshStandardMaterial({ color: 'red' })
    const mesh = new Mesh(new BoxGeometry(), source)
    const neighbor = new Mesh(mesh.geometry, source)
    mesh.castShadow = true
    const fade = fadeMesh(mesh)
    fade.update()
    expect(mesh.material.opacity).toBe(0.12)
    expect(mesh.material.depthWrite).toBe(false)
    expect(mesh.castShadow).toBe(false)
    expect(neighbor.material.opacity).toBe(1)
    source.color.set('blue')
    fade.update()
    expect(mesh.material.color.equals(source.color)).toBe(true)
    fade.restore()
    expect(mesh.material).toBe(source)
    expect(mesh.material.opacity).toBe(1)
    expect(mesh.material.transparent).toBe(false)
    expect(mesh.material.depthWrite).toBe(true)
    expect(mesh.castShadow).toBe(true)
  })

  it('preserves existing glass opacity and replacement materials', () => {
    const glass = new MeshStandardMaterial({ transparent: true, opacity: 0.05, depthWrite: false })
    const mesh = new Mesh(new BoxGeometry(), [glass, new MeshStandardMaterial()])
    const fade = fadeMesh(mesh)
    fade.update()
    expect(mesh.material.map(material => material.opacity)).toEqual([0.05, 0.12])
    const replacement = [new MeshStandardMaterial()]
    mesh.material = replacement
    fade.restore()
    expect(mesh.material).toBe(replacement)
    expect(glass.opacity).toBe(0.05)
  })

  it('targets nested walls independently from roofs and excludes hidden or preview geometry', () => {
    const roof = new Group(); roof.userData.semanticRef = 'roof/main'
    const wall = new Group(); wall.userData.semanticRef = 'wall/gable'
    const mesh = new Mesh()
    roof.add(wall); wall.add(mesh)
    expect(transparencyRef(mesh)).toBe('wall/gable')
    roof.visible = false
    expect(transparencyRef(mesh)).toBeNull()
    roof.visible = true; roof.userData.captureSource = 'ghost'
    expect(transparencyRef(mesh)).toBeNull()
  })
})
