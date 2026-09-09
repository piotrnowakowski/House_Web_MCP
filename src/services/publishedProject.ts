import publishedData from '../../project-data/zielonki/project.json'
import legacyData from '../../project-data/zielonki/legacy-base.json'
import { parseProject } from '../domain/schema'

/** Tracked product data; the legacy baseline is immutable after the initial browser-data recovery. */
export const publishedProject = parseProject(publishedData)
export const legacyProjectBase = parseProject(legacyData)
