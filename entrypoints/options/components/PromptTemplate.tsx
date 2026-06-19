import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DefaultPromptTemplate, Language_Placeholder, Selection_Placeholder, SourceContext_Placeholder } from '@/const'
import { promptTemplate } from '@/utils/storage'
import { useDebounce } from '@uidotdev/usehooks'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import OptionSection from './OptionSection'

const PromptTemplate = () => {
  const [inputValue, setInputValue] = useState<string>(DefaultPromptTemplate)
  const debouncedInputValue = useDebounce(inputValue, 1500)
  const hydratedRef = useRef(false)
  const userEditedRef = useRef(false)

  useEffect(() => {
    promptTemplate.getValue().then((storedVal) => {
      if (storedVal) setInputValue(storedVal)
      hydratedRef.current = true
    })
  }, [])

  useEffect(() => {
    if (!hydratedRef.current || !userEditedRef.current) return
    if (hasRequiredPlaceholders) {
      promptTemplate
        .setValue(debouncedInputValue)
        .then(() => toast.success('Prompt template saved'))
        .catch(() => toast.error('Save failed'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInputValue])

  const handleReset = () => {
    userEditedRef.current = false
    setInputValue(DefaultPromptTemplate)
    promptTemplate
      .setValue(DefaultPromptTemplate)
      .then(() => toast('Reset to default'))
      .catch(() => toast.error('Reset failed'))
  }

  const hasSelectionPlaceholder = inputValue.includes(Selection_Placeholder)
  const hasLanguagePlaceholder = inputValue.includes(Language_Placeholder)
  const hasRequiredPlaceholders = hasSelectionPlaceholder && hasLanguagePlaceholder
  const missing = !hasRequiredPlaceholders
  const missingLabel = !hasSelectionPlaceholder && !hasLanguagePlaceholder
    ? `${Selection_Placeholder} and ${Language_Placeholder}`
    : !hasSelectionPlaceholder
    ? Selection_Placeholder
    : Language_Placeholder

  return (
    <OptionSection
      id="prompt"
      title="Prompt template"
      description={
        <>
          Customise this user prompt freely. Vocabify keeps assistant identity and the required
          output JSON contract in internal system messages. Use{' '}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">{Selection_Placeholder}</code>{' '}
          and{' '}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">{Language_Placeholder}</code>{' '}
          to describe the lookup.{' '}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">{SourceContext_Placeholder}</code>{' '}
          is optional.
        </>
      }
    >
      <Textarea
        value={inputValue}
        onChange={(event) => {
          userEditedRef.current = true
          setInputValue(event.target.value)
        }}
        placeholder="Enter your prompt template..."
        rows={10}
        className="w-full font-mono text-[12px] leading-relaxed scrollbar-thin"
        aria-label="Prompt template"
      />
      {missing && (
        <p className="flex items-start gap-2 rounded-[6px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Please include{' '}
            <code className="rounded bg-destructive/15 px-1 py-0.5 font-mono text-[11px]">{missingLabel}</code>{' '}
            in your prompt.
          </span>
        </p>
      )}
      <Button variant="outline" onClick={handleReset} size="sm">
        <RotateCcw className="h-3 w-3" />
        Reset to default
      </Button>
    </OptionSection>
  )
}

export default PromptTemplate
