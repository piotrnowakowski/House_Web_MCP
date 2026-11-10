import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Line, LineBasicMaterial, Mesh, MeshStandardMaterial } from 'three'
import { fadeMesh, isTransparencyObject, transparencyRef } from './transparencyMaterials'

describe('temporary object transparency', () => {
  it('isolates shared materials and restores their current finish and shadows', () => {
    const source = new MeshStandardMaterial({ color: 'red' })
    const mesh = new Mesh(new BoxGeometry(), source)
    const neighbor = new Mesh(mesh.geometry, source)
    mesh.castShadow = true
    const fade = fadeMesh(mesh)
    fade.update()
    expect(mesh.material.opacity).toBe(0)
    expect(mesh.material.depthWrite).toBe(false)
    expect(mesh.material.visible).toBe(false)
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
    expect(mesh.material.visible).toBe(true)
    expect(mesh.castShadow).toBe(true)
  })

  it('preserves existing glass opacity and replacement materials', () => {
    const glass = new MeshStandardMaterial({ transparent: true, opacity: 0.05, depthWrite: false })
    const mesh = new Mesh(new BoxGeometry(), [glass, new MeshStandardMaterial()])
    const fade = fadeMesh(mesh)
    fade.update()
    expect(mesh.material.map(material => material.opacity)).toEqual([0, 0])
    const replacement = [new MeshStandardMaterial()]
    mesh.material = replacement
    fade.restore()
    expect(mesh.material).toBe(replacement)
    expect(glass.opacity).toBe(0.05)
  })

  it('hides object outlines and restores their original material', () => {
    const source = new LineBasicMaterial()
    const line = new Line(undefined, source)
    expect(isTransparencyObject(line)).toBe(true)
    const fade = fadeMesh(line); fade.update()
    expect(line.material.visible).toBe(false)
    expect(source.visible).toBe(true)
    fade.restore()
    expect(line.material).toBe(source)
    expect(line.material.visible).toBe(true)
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

  it('targets interior openings separately and ignores invisible picking surfaces', () => {
    const wall = new Group(); wall.userData.dragTarget = { kind: 'wall', ref: 'wall/1' }
    const opening = new Group(); opening.userData.dragTarget = { kind: 'opening', ref: 'window/1' }
    const glass = new Mesh(); const body = new Mesh(); const hit = new Mesh()
    wall.add(opening, body, hit); opening.add(glass)
    hit.userData.editorOnly = true
    expect(transparencyRef(glass)).toBe('window/1')
    expect(transparencyRef(body)).toBe('wall/1')
    expect(transparencyRef(hit)).toBeNull()
    const zero = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ opacity: 0, transparent: true }))
    const fade = fadeMesh(zero); fade.update()
    expect(zero.material.opacity).toBe(0)
    fade.restore()
  })
})
