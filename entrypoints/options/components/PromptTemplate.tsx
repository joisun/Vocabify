import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DefaultPromptTemplate, Language_Placeholder, Selection_Placeholder } from '@/const'
import { promptTemplate } from '@/utils/storage'
import { useDebounce } from '@uidotdev/usehooks'
import { AlertCircle, RotateCcw, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import HeadlingTitle from './common/HeadlingTitle'
import Subtitle from './common/Subtitle'
import OptionSection from './OptionSection'

const PromptTemplate = () => {
  const [inputValue, setInputValue] = useState<string>(DefaultPromptTemplate)
  const debouncedInputValue = useDebounce(inputValue, 1500)

  useEffect(() => {
    promptTemplate.getValue().then((storedVal) => {
      if (storedVal) setInputValue(storedVal)
    })
  }, [])

  const hasSelectionPlaceholder = inputValue.includes(Selection_Placeholder)
  const hasLanguagePlaceholder = inputValue.includes(Language_Placeholder)

  useEffect(() => {
    if (hasSelectionPlaceholder && hasLanguagePlaceholder) {
      promptTemplate
        .setValue(inputValue)
        .then(() => {
          toast.success('Prompt template saved', {
            description: 'Your custom prompt is now active.',
          })
        })
        .catch(() => {
          toast.error('Save failed', {
            description: 'Could not save the prompt template.',
          })
        })
    }
  }, [debouncedInputValue])

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value)
  }

  const handleReset = () => {
    setInputValue(DefaultPromptTemplate)
    promptTemplate
      .setValue(DefaultPromptTemplate)
      .then(() => {
        toast('Reset to default', {
          description: 'The prompt template has been restored.',
        })
      })
      .catch(() => {
        toast.error('Reset failed', {
          description: 'Try reloading the extension.',
        })
      })
  }

  const missing = !hasSelectionPlaceholder || !hasLanguagePlaceholder
  const missingLabel = !hasSelectionPlaceholder && !hasLanguagePlaceholder
    ? `${Selection_Placeholder} and ${Language_Placeholder}`
    : !hasSelectionPlaceholder
    ? Selection_Placeholder
    : Language_Placeholder

  return (
    <OptionSection>
      <HeadlingTitle>
        <Wand2 className="h-5 w-5 text-primary" />
        Prompt Template
      </HeadlingTitle>
      <Subtitle>
        Customise how Vocabify asks the AI for explanations. Use{" "}
        <code className="rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-[12px] text-foreground">
          {Selection_Placeholder}
        </code>{" "}
        for the selected text and{" "}
        <code className="rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-[12px] text-foreground">
          {Language_Placeholder}
        </code>{" "}
        for the target language. Changes save automatically.
      </Subtitle>

      <div className="relative">
        <Textarea
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter your prompt template..."
          rows={12}
          className="w-full font-mono text-[13px] leading-relaxed scrollbar-thin"
          aria-label="Prompt template"
        />
        {missing && (
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-[13px] text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Please include{" "}
              <code className="rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-[12px]">
                {missingLabel}
              </code>{" "}
              in your prompt.
            </span>
          </p>
        )}
      </div>

      <Button variant="outline" onClick={handleReset} size="sm">
        <RotateCcw className="h-3.5 w-3.5" />
        Reset to default
      </Button>
    </OptionSection>
  )
}

export default PromptTemplate
