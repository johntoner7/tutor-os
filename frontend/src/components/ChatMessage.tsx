import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import type { Message } from '../types'
import type { GlossaryMap } from '../hooks/useGlossary'
import { GlossaryTerm } from './GlossaryTerm'

interface Props {
  message: Message
  glossary: GlossaryMap
  onTopicSelect?: (slug: string) => void
}

function annotateText(text: string, glossary: GlossaryMap): React.ReactNode {
  if (glossary.size === 0) return text
  const terms = [...glossary.keys()].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const matched = match[0]
    const definition = glossary.get(matched.toLowerCase())!
    parts.push(<GlossaryTerm key={match.index} term={matched} definition={definition}>{matched}</GlossaryTerm>)
    last = match.index + matched.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : text
}

function processChildren(children: React.ReactNode, glossary: GlossaryMap): React.ReactNode {
  return React.Children.map(children, (child) =>
    typeof child === 'string' ? annotateText(child, glossary) : child
  )
}

function makeComponents(glossary: GlossaryMap): Components {
  const wrap = (children: React.ReactNode) => processChildren(children, glossary)
  return {
    blockquote: ({ children }) => (
      <div className="my-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-amber-900">
        {children}
      </div>
    ),
    p: ({ children }) => <p>{wrap(children)}</p>,
    li: ({ children }) => <li>{wrap(children)}</li>,
    h1: ({ children }) => <h1>{wrap(children)}</h1>,
    h2: ({ children }) => <h2>{wrap(children)}</h2>,
    h3: ({ children }) => <h3>{wrap(children)}</h3>,
    strong: ({ children }) => <strong>{wrap(children)}</strong>,
    em: ({ children }) => <em>{wrap(children)}</em>,
  }
}

export function ChatMessage({ message, glossary, onTopicSelect }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-red-600 text-white rounded-br-sm'
            : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-blockquote:not-prose">
            <ReactMarkdown components={makeComponents(glossary)}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {message.suggestedTopicSlug && message.suggestedTopicName && onTopicSelect && (
        <button
          onClick={() => onTopicSelect(message.suggestedTopicSlug!)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          {message.suggestedTopicName}
        </button>
      )}
    </div>
  )
}
