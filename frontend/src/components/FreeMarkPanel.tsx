import { useState } from 'react'
import { markFreeAnswer } from '../api/client'
import type { FreeMarkResponse, Topic } from '../types'
import { MarkFeedback } from './MarkFeedback'
import { ImageIcon, Type } from 'lucide-react'

interface Props {
  sessionId: string | null
  topics: Topic[]
  onClose: () => void
}

type InputMode = 'text' | 'image'
type Step = 'question' | 'answer'

const MAX_BYTES = 4 * 1024 * 1024

export function FreeMarkPanel({ sessionId, onClose }: Props) {
  const [step, setStep] = useState<Step>('question')
  const [inputMode, setInputMode] = useState<InputMode>('text')

  // Question step
  const [question, setQuestion] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  // Answer step
  const [answer, setAnswer] = useState('')
  const [marks, setMarks] = useState(1)
  const [answerFromImage, setAnswerFromImage] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FreeMarkResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageError(null)
    if (!file) { setImageFile(null); setImagePreviewUrl(null); return }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setImageError('Use JPEG, PNG, GIF, or WEBP.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_BYTES) {
      setImageError('Image must be under 4 MB.')
      e.target.value = ''
      return
    }
    setImageFile(file)
    setImagePreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const questionReady = inputMode === 'text' ? question.trim().length >= 5 : !!imageFile

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!answerFromImage && !answer.trim()) return
    setSubmitting(true)
    setError(null)
    setFeedback(null)
    try {
      const image_base64 = imageFile ? await toBase64(imageFile) : undefined
      const result = await markFreeAnswer({
        question,
        student_answer: answerFromImage ? '' : answer,
        marks_available: marks,
        session_id: sessionId,
        image_base64,
        image_extract_answer: answerFromImage,
      })
      setFeedback(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setStep('question')
    setInputMode('text')
    setQuestion('')
    setImageFile(null)
    setImagePreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setImageError(null)
    setAnswer('')
    setMarks(1)
    setAnswerFromImage(false)
    setFeedback(null)
    setError(null)
  }

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Step 1 — Question */}
      {!feedback && step === 'question' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-4 pt-5 pb-3">
            <p className="text-sm font-semibold text-gray-900">What's the question?</p>
            <p className="text-xs text-gray-400 mt-0.5">Type it out or upload a photo</p>
          </div>

          {/* Input mode toggle */}
          <div className="shrink-0 px-4 pb-3">
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                  inputMode === 'text' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Type className="w-3 h-3" /> Type
              </button>
              <button
                type="button"
                onClick={() => setInputMode('image')}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                  inputMode === 'image' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ImageIcon className="w-3 h-3" /> Photo
              </button>
            </div>
          </div>

          <div className="flex-1 px-4 pb-4 flex flex-col gap-3 min-h-0">
            {inputMode === 'text' ? (
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Paste or type the question here…"
                maxLength={2000}
                autoFocus
                className="flex-1 min-h-0 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300"
              />
            ) : (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                {!imageFile ? (
                  <label className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-colors">
                    <ImageIcon className="w-7 h-7 text-gray-300" />
                    <span className="text-xs text-gray-400">Tap to upload a photo of the question</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative flex-1 flex items-start">
                    <img
                      src={imagePreviewUrl!}
                      alt="Question"
                      className="max-h-full rounded-xl border border-gray-200 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null }) }}
                      className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-500 border border-gray-200 shadow-sm text-xs"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {imageError && <p className="text-xs text-red-500">{imageError}</p>}
              </div>
            )}

            <button
              type="button"
              disabled={!questionReady}
              onClick={() => setStep('answer')}
              className="shrink-0 w-full rounded-xl bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Answer */}
      {!feedback && step === 'answer' && (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-4 pt-5 pb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setStep('question'); setAnswerFromImage(false) }}
              className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
            >
              ←
            </button>
            <p className="text-sm font-semibold text-gray-900">Your answer</p>
          </div>

          {/* Question recap */}
          <div className="shrink-0 mx-4 mb-3 rounded-lg bg-gray-50 px-3 py-2">
            {imageFile && !question ? (
              <img src={imagePreviewUrl!} alt="Question" className="max-h-24 rounded object-contain" />
            ) : (
              <p className="text-xs text-gray-600 line-clamp-3">{question}</p>
            )}
          </div>

          <div className="flex-1 px-4 pb-4 flex flex-col gap-3 min-h-0">

            {/* If image was uploaded, offer to read answer from it */}
            {imageFile && (
              <button
                type="button"
                onClick={() => setAnswerFromImage(v => !v)}
                className={`shrink-0 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  answerFromImage
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${answerFromImage ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                  {answerFromImage && <span className="text-white text-xs leading-none">✓</span>}
                </div>
                <span className="text-xs font-medium">My answer is also in the photo — read it automatically</span>
              </button>
            )}

            {!answerFromImage && (
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Write your answer here…"
                maxLength={2000}
                autoFocus={!imageFile}
                className="flex-1 min-h-0 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300"
              />
            )}

            {answerFromImage && (
              <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50/40">
                <p className="text-xs text-red-500 text-center px-4">AI will extract your answer from the image</p>
              </div>
            )}

            {/* Marks inline with submit */}
            <div className="shrink-0 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 whitespace-nowrap">Marks available</label>
                <input
                  type="number"
                  value={marks}
                  onChange={e => setMarks(Math.min(20, Math.max(1, Number(e.target.value))))}
                  min={1}
                  max={20}
                  className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300"
                />
              </div>
              <button
                type="submit"
                disabled={(!answerFromImage && !answer.trim()) || submitting}
                className="flex-1 rounded-xl bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                {submitting ? 'Marking…' : 'Mark it'}
              </button>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>
        </form>
      )}

      {/* Result */}
      {feedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5 space-y-0.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question</p>
            <p className="text-sm text-gray-800">{feedback.extracted_question ?? question}</p>
            {feedback.extracted_question && (
              <p className="text-xs text-gray-400">Read from image</p>
            )}
          </div>

          {feedback.extracted_answer && (
            <div className="rounded-lg bg-gray-50 px-3 py-2.5 space-y-0.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your answer <span className="font-normal normal-case">(read from image)</span></p>
              <p className="text-sm text-gray-800 italic">{feedback.extracted_answer}</p>
            </div>
          )}

          <MarkFeedback feedback={feedback} />

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setFeedback(null); setAnswer(''); setStep('answer') }}
              className="flex-1 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 py-2.5 hover:bg-gray-50 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={handleReset}
              className="flex-1 rounded-xl bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 transition-colors"
            >
              New question
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
