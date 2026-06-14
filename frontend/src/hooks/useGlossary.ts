import { useEffect, useState } from 'react'
import { fetchGlossary } from '../api/client'
import type { GlossaryEntry } from '../api/client'

export type GlossaryMap = Map<string, string>

export function useGlossary(): GlossaryMap {
  const [map, setMap] = useState<GlossaryMap>(new Map())

  useEffect(() => {
    fetchGlossary()
      .then((entries: GlossaryEntry[]) => {
        setMap(new Map(entries.map((e) => [e.term.toLowerCase(), e.definition])))
      })
      .catch(err => console.warn('[useGlossary] failed to load glossary:', err))
  }, [])

  return map
}
