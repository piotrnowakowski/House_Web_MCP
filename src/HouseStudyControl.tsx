import { House } from 'lucide-react'
import { useStudioStore } from './state/store'
import './house-studies.css'

/** One entry point for every project and its saved versions. */
export function HouseStudyControl({ onOpen }: { onOpen?: () => void }) {
  const openLauncher = useStudioStore((state) => state.openLauncher)
  const launcherOpen = useStudioStore((state) => state.launcherOpen)
  return <button className="house-study-toggle" aria-label="Projects" title="Projects" aria-haspopup="dialog" aria-expanded={launcherOpen}
    onClick={onOpen ?? (() => { void openLauncher() })}><House size={20} /></button>
}
