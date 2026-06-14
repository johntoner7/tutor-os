import { useState, useRef, useEffect } from 'react'

interface Props {
  term: string
  definition: string
  children: React.ReactNode
}

export function GlossaryTerm({ term, definition, children }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span ref={ref} className="relative inline-block">
      <span
        className="cursor-pointer border-b border-dotted border-gray-500 text-gray-800"
        onClick={() => setOpen((o) => !o)}
        title={term}
      >
        {children}
      </span>
      {open && (
        <span className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg">
          <span className="mb-1 block font-semibold text-gray-900">{term}</span>
          {definition}
        </span>
      )}
    </span>
  )
}
