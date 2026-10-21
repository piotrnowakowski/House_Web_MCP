import archivedProjects from '../../project-data/archived-projects.json'

// Keep recovery data intact while retiring these identities, including their saved versions.
export const isArchivedProject = (ref: string) => archivedProjects.some(project => ref === project.ref || ref.startsWith(`${project.ref}/`))
