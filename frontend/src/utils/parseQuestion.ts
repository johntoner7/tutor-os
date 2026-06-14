export interface QuestionPart {
  label: string        // 'a', 'b', 'a_i', 'a_ii', 'c_iii', etc.
  displayLabel: string // '(a)', '(b)', '(a)(i)', '(c)(iii)', etc.
  text: string         // the question text for this part
  marks: number | null
}

export interface ParsedQuestion {
  preamble: string        // context before sub-parts (tables, experiment description etc.)
  parts: QuestionPart[]  // empty if the question has no labelled sub-parts
}

// Matches: (a), (b)(i), (b)(ii), (a)(i) etc. at the start of a line
const PART_RE = /^\(([a-z])\)(?:\([ivx]+\))?\s*/i

// Extracts trailing mark allocation: [2 marks], (2 marks), [1 mark], (1 mark)
const MARKS_RE = /[\[(](\d+)\s+marks?[\])]\s*$/i

function extractMarks(text: string): { text: string; marks: number | null } {
  const m = text.match(MARKS_RE)
  if (!m) return { text: text.trim(), marks: null }
  return {
    text: text.slice(0, m.index).trim(),
    marks: parseInt(m[1], 10),
  }
}

function formatDisplayLabel(label: string): string {
  const parts = label.split('_')
  return parts.map(p => `(${p})`).join('')
}

// Within a top-level part's text, split on roman-numeral sub-parts like (i), (ii), (iii)
function expandSubParts(topLabel: string, rawText: string): QuestionPart[] {
  // Split on roman numeral markers at the start of a segment
  const blocks = rawText.split(/(?=\([ivx]+\)\s)/i)

  const subParts: QuestionPart[] = []
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    const subMatch = trimmed.match(/^\(([ivx]+)\)\s*(.*)$/si)
    if (subMatch) {
      const subLabel = subMatch[1].toLowerCase()
      const { text, marks } = extractMarks(subMatch[2].trim())
      subParts.push({
        label: `${topLabel}_${subLabel}`,
        displayLabel: formatDisplayLabel(`${topLabel}_${subLabel}`),
        text,
        marks,
      })
    } else {
      // Preamble text before the first sub-part — prepend to first sub-part or keep as standalone
      if (subParts.length === 0) {
        const { text, marks } = extractMarks(trimmed)
        subParts.push({ label: topLabel, displayLabel: `(${topLabel})`, text, marks })
      } else {
        // Append to the last sub-part's text
        subParts[subParts.length - 1].text += ' ' + trimmed
      }
    }
  }

  if (subParts.length === 0) {
    const { text, marks } = extractMarks(rawText)
    return [{ label: topLabel, displayLabel: `(${topLabel})`, text, marks }]
  }

  return subParts
}

export function parseQuestion(raw: string): ParsedQuestion {
  const lines = raw.split('\n')

  // Find the first line that starts a labelled sub-part
  const firstPartIdx = lines.findIndex(l => PART_RE.test(l.trim()))

  if (firstPartIdx === -1) {
    // No sub-parts — entire question is a single block
    return { preamble: raw.trim(), parts: [] }
  }

  const preamble = lines.slice(0, firstPartIdx).join('\n').trim()

  // Collect remaining lines and group into top-level parts
  const remainder = lines.slice(firstPartIdx).join('\n')

  // Split on lines that start a new top-level part (a), (b), (c)...
  const partBlocks = remainder.split(/\n(?=\([a-z]\)\s)/i)

  const parts: QuestionPart[] = []
  for (const block of partBlocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    const match = trimmed.match(/^\(([a-z])\)\s*(.*)$/s)
    if (!match) continue

    const topLabel = match[1]
    const innerText = match[2].trim()

    // Expand into sub-parts if the text contains roman-numeral markers
    const expanded = expandSubParts(topLabel, innerText)
    parts.push(...expanded)
  }

  // If parsing yielded nothing useful, fall back to single block
  if (parts.length === 0) {
    return { preamble: raw.trim(), parts: [] }
  }

  return { preamble, parts }
}

export function combineAnswers(parts: QuestionPart[], answers: Record<string, string>): string {
  return parts
    .map(p => `${p.displayLabel} ${answers[p.label] ?? ''}`.trim())
    .filter(Boolean)
    .join('\n\n')
}
