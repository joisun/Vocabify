import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Loader2, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AI_PROVIDER_TEMPLATES,
  DEFAULT_PROVIDER_TEMPLATE,
  getProviderTemplate,
  type AIProviderId,
  type AiAgentApiKey,
} from '@/typings/aiModelAdaptor'
import { agentsStorage, getNormalizedAgents } from '@/utils/storage'
import OptionSection from './OptionSection'

type ModelFetchState = {
  loading: boolean
  error: string
}

type ProviderChoice = {
  id: string
  label: string
  providerId: AIProviderId | `custom:${string}`
  baseURL?: string
  defaultModel: string
  staticModels: string[]
  kind: 'built-in' | 'compatible' | 'custom'
}

const CUSTOM_PROVIDER_ID = 'custom'

const COMPATIBLE_PRESETS: ProviderChoice[] = [
  {
    id: 'glm',
    label: 'GLM',
    providerId: 'custom:glm',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4.5-flash',
    staticModels: ['glm-4.5-flash', 'glm-4.5', 'glm-4-plus'],
    kind: 'compatible',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    providerId: 'custom:kimi',
    baseURL: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2-0711-preview',
    staticModels: ['kimi-k2-0711-preview', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    kind: 'compatible',
  },
]

const CUSTOM_CHOICE: ProviderChoice = {
  id: CUSTOM_PROVIDER_ID,
  label: 'Custom',
  providerId: 'custom:provider',
  baseURL: '',
  defaultModel: 'gpt-4o-mini',
  staticModels: ['gpt-4o-mini', 'gpt-4o', 'o4-mini'],
  kind: 'custom',
}

const BUILT_IN_CHOICES: ProviderChoice[] = AI_PROVIDER_TEMPLATES.map((template) => ({
  id: template.id,
  label: template.label,
  providerId: template.id,
  defaultModel: template.defaultModel,
  staticModels: template.staticModels,
  kind: 'built-in',
}))

const PROVIDER_CHOICES = [...BUILT_IN_CHOICES, ...COMPATIBLE_PRESETS, CUSTOM_CHOICE]

const MODEL_ENDPOINTS: Partial<Record<AIProviderId, string>> = {
  openai: 'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/models',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  deepseek: 'https://api.deepseek.com/v1/models',
}

function uniqueModels(models: string[]) {
  return Array.from(new Set(models.map((item) => item.trim()).filter(Boolean)))
}

function normalizeBaseURL(url: string) {
  return url.trim().replace(/\/$/, '')
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'provider'
}

function findChoiceForAgent(agent: AiAgentApiKey | null) {
  if (!agent) return DEFAULT_PROVIDER_TEMPLATE.id
  const builtIn = getProviderTemplate(agent.providerId)
  if (builtIn) return builtIn.id
  const preset = COMPATIBLE_PRESETS.find((item) =>
    item.providerId === agent.providerId || normalizeBaseURL(item.baseURL || '') === normalizeBaseURL(agent.baseURL || ''),
  )
  return preset?.id || CUSTOM_PROVIDER_ID
}

function getChoice(choiceId: string) {
  return PROVIDER_CHOICES.find((choice) => choice.id === choiceId) || BUILT_IN_CHOICES[0]
}

function getStaticModels(choice: ProviderChoice, model: string) {
  return uniqueModels([model, choice.defaultModel, ...choice.staticModels])
}

function getModelsEndpoint(choice: ProviderChoice, baseURL: string) {
  if (choice.kind !== 'built-in') return `${normalizeBaseURL(baseURL)}/models`
  return MODEL_ENDPOINTS[choice.providerId as AIProviderId]
}

async function fetchProviderModels(params: {
  choice: ProviderChoice
  baseURL: string
  apiKey: string
}) {
  const { choice, baseURL, apiKey } = params
  const endpoint = getModelsEndpoint(choice, baseURL)
  if (!endpoint) throw new Error('This provider does not expose a model list endpoint.')

  if (choice.providerId === 'google') {
    const response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`)
    if (!response.ok) throw new Error(`Google model request failed: ${response.status}`)
    const data = await response.json() as { models?: Array<{ name?: string, supportedGenerationMethods?: string[] }> }
    return uniqueModels((data.models || [])
      .filter((item) => !item.supportedGenerationMethods || item.supportedGenerationMethods.includes('generateContent'))
      .map((item) => (item.name || '').replace(/^models\//, '')))
  }

  if (choice.providerId === 'anthropic') {
    const response = await fetch(endpoint, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!response.ok) throw new Error(`Anthropic model request failed: ${response.status}`)
    const data = await response.json() as { data?: Array<{ id?: string }> }
    return uniqueModels((data.data || []).map((item) => item.id || ''))
  }

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
  if (!response.ok) throw new Error(`Model request failed: ${response.status}`)
  const data = await response.json() as { data?: Array<{ id?: string }>, models?: Array<{ id?: string, name?: string }> }
  return uniqueModels([
    ...(data.data || []).map((item) => item.id || ''),
    ...(data.models || []).map((item) => item.id || item.name || ''),
  ])
}

const ApiKeysConfigComponent = () => {
  const [activeAgent, setActiveAgent] = useState<AiAgentApiKey | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>(DEFAULT_PROVIDER_TEMPLATE.id)
  const [baseURL, setBaseURL] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(DEFAULT_PROVIDER_TEMPLATE.defaultModel)
  const [models, setModels] = useState<string[]>(DEFAULT_PROVIDER_TEMPLATE.staticModels)
  const [fetchState, setFetchState] = useState<ModelFetchState>({ loading: false, error: '' })
  const [saving, setSaving] = useState(false)

  const fetchTimer = useRef<number | null>(null)
  const fetchSeq = useRef(0)
  const selectedChoice = useMemo(() => getChoice(selectedProvider), [selectedProvider])
  const isCustom = selectedChoice.kind === 'custom'
  const needsBaseURL = selectedChoice.kind !== 'built-in'

  useEffect(() => {
    getNormalizedAgents().then((value) => {
      const current = value[0] || null
      setActiveAgent(current)
      if (!current) return

      const choiceId = findChoiceForAgent(current)
      const choice = getChoice(choiceId)
      setSelectedProvider(choiceId)
      setBaseURL(current.baseURL || choice.baseURL || '')
      setApiKey(current.apiKey)
      setModel(current.model || choice.defaultModel)
      setModels(getStaticModels(choice, current.model))
    })
  }, [])

  useEffect(() => {
    const trimmedKey = apiKey.trim()
    const trimmedBaseURL = baseURL.trim()
    const requestSeq = ++fetchSeq.current
    if (!trimmedKey) {
      setModels(getStaticModels(selectedChoice, model))
      setFetchState({ loading: false, error: '' })
      return
    }
    if (needsBaseURL && !trimmedBaseURL) {
      setModels(getStaticModels(selectedChoice, model))
      setFetchState({ loading: false, error: 'Base URL is required for OpenAI-compatible providers.' })
      return
    }

    if (fetchTimer.current) window.clearTimeout(fetchTimer.current)
    fetchTimer.current = window.setTimeout(async () => {
      try {
        setFetchState({ loading: true, error: '' })
        const fetchedModels = await fetchProviderModels({
          choice: selectedChoice,
          baseURL: trimmedBaseURL,
          apiKey: trimmedKey,
        })
        if (requestSeq !== fetchSeq.current) return
        setModels(fetchedModels.length ? fetchedModels : getStaticModels(selectedChoice, model))
      } catch (error) {
        if (requestSeq !== fetchSeq.current) return
        setFetchState({
          loading: false,
          error: error instanceof Error ? error.message : 'Model list unavailable.',
        })
        setModels(getStaticModels(selectedChoice, model))
        return
      }
      if (requestSeq !== fetchSeq.current) return
      setFetchState({ loading: false, error: '' })
    }, 500)

    return () => {
      if (fetchTimer.current) window.clearTimeout(fetchTimer.current)
    }
  }, [apiKey, baseURL, model, needsBaseURL, selectedChoice])

  const canSave = Boolean(
    apiKey.trim()
    && model.trim()
    && (!needsBaseURL || baseURL.trim())
  )

  const isDirty = !activeAgent
    || activeAgent.providerId !== resolveProviderId().providerId
    || activeAgent.providerLabel !== resolveProviderId().providerLabel
    || activeAgent.apiKey !== apiKey.trim()
    || activeAgent.model !== model.trim()
    || (activeAgent.baseURL || '') !== (needsBaseURL ? normalizeBaseURL(baseURL) : '')

  function resolveProviderId() {
    if (isCustom) {
      return {
        providerId: `custom:${slugify(baseURL || 'custom')}` as `custom:${string}`,
        providerLabel: 'Custom',
      }
    }

    return {
      providerId: selectedChoice.providerId,
      providerLabel: selectedChoice.label,
    }
  }

  function selectProvider(choiceId: string) {
    if (choiceId === selectedProvider) return
    const choice = getChoice(choiceId)
    fetchSeq.current += 1
    if (fetchTimer.current) window.clearTimeout(fetchTimer.current)
    setSelectedProvider(choiceId)
    setFetchState({ loading: false, error: '' })
    setBaseURL(choice.baseURL || '')
    setApiKey('')
    setModel(choice.defaultModel)
    setModels(choice.staticModels)
  }

  async function saveProvider() {
    if (!canSave || saving) return
    const identity = resolveProviderId()
    const next: AiAgentApiKey = {
      providerId: identity.providerId,
      providerLabel: identity.providerLabel,
      apiKey: apiKey.trim(),
      model: model.trim(),
      ...(needsBaseURL ? { baseURL: normalizeBaseURL(baseURL) } : {}),
    }
    setSaving(true)
    try {
      await agentsStorage.setValue([next])
      setActiveAgent(next)
    } finally {
      setSaving(false)
    }
  }

  async function clearProvider() {
    if (saving) return
    setSaving(true)
    try {
      await agentsStorage.setValue([])
      setActiveAgent(null)
      setApiKey('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OptionSection
      id="providers"
      title="API provider"
    >
      <Card className="border-border/50 shadow-none dark:border-white/[0.03]">
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
            <Field label="Provider">
              <Select value={selectedProvider} onValueChange={selectProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_CHOICES.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {needsBaseURL ? (
              <Field label="Base URL">
                <Input
                  value={baseURL}
                  onChange={(event) => setBaseURL(event.target.value)}
                  placeholder="https://api.example.com/v1"
                  aria-label="Provider base URL"
                />
              </Field>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="API key">
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste API key"
                aria-label="Provider API key"
                className="font-mono"
              />
            </Field>

            <Field label="Model">
              <Input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder={selectedChoice.defaultModel}
                aria-label="Provider model"
                className="font-mono"
                list="vocabify-provider-models"
              />
              <datalist id="vocabify-provider-models">
                {models.map((item) => <option key={item} value={item} />)}
              </datalist>
            </Field>
          </div>

          {fetchState.loading || fetchState.error ? (
            <div className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
              {fetchState.loading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading models
                </>
              ) : fetchState.error}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end gap-2 p-4 pt-0">
          <Button
            type="button"
            variant="ghost"
            onClick={clearProvider}
            disabled={!activeAgent || saving}
            className="text-muted-foreground hover:!bg-destructive/10 hover:!text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
          <Button
            type="button"
            onClick={saveProvider}
            disabled={!canSave || !isDirty || saving}
            className="disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </CardFooter>
      </Card>

    </OptionSection>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export default ApiKeysConfigComponent
