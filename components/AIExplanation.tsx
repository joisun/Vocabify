import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { saveRecord } from '@/lib/vocabifyDb'
import { Loader2, Save } from 'lucide-react'

interface AIExplanationProps {
  selectedText: string
}

export function AIExplanation({ selectedText }: AIExplanationProps) {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (selectedText) {
      startAIStream()
    }
  }, [selectedText])

  async function startAIStream() {
    setLoading(true)
    setExplanation('')

    try {
      const port = chrome.runtime.connect({ name: 'ai-stream' })

      port.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          setExplanation((prev) => prev + msg.chunk)
        } else if (msg.type === 'complete') {
          setLoading(false)
          port.disconnect()
        } else if (msg.type === 'error') {
          console.error('AI stream error:', msg.error)
          setExplanation('Error: ' + msg.error)
          setLoading(false)
          port.disconnect()
        }
      })

      port.postMessage({ type: 'start', text: selectedText })
    } catch (error) {
      console.error('Failed to start AI stream:', error)
      setExplanation('Failed to get AI explanation')
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!explanation.trim()) return

    setSaving(true)
    try {
      const result = await saveRecord(selectedText, explanation)
      console.log('Saved:', result)
      // Show success message
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <Card className="p-4">
        <h3 className="font-semibold mb-2">Selected Text</h3>
        <p className="text-sm">{selectedText}</p>
      </Card>

      <div className="flex-1 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">AI Explanation</h3>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <Textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="AI explanation will appear here..."
          className="flex-1 min-h-[200px]"
        />
      </div>

      <Button onClick={handleSave} disabled={saving || !explanation.trim()}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save to Vocabulary
          </>
        )}
      </Button>
    </div>
  )
}
