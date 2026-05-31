import { useEffect, useMemo, useRef, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { GripVertical, KeyRound, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  AI_PROVIDER_TEMPLATES,
  DEFAULT_PROVIDER_TEMPLATE,
  getProviderTemplate,
  type AIProviderId,
  type AiAgentApiKey,
  type AiAgentApiKeys,
} from '@/typings/aiModelAdaptor'
import { agentsStorage, getNormalizedAgents } from '@/utils/storage'
import HeadlingTitle from './common/HeadlingTitle'
import Subtitle from './common/Subtitle'
import OptionSection from './OptionSection'

type ModelFetchState = {
  loading: boolean
  error: string
}

type CustomProviderDraft = {
  label: string
  baseURL: string
  defaultModel: string
}

type ActiveProvider = {
  providerId: AIProviderId | `custom:${string}`
  providerLabel: string
  baseURL: string
  defaultModel: string
  staticModels: string[]
}

const CUSTOM_PROVIDER_VALUE = '__custom__'

const MODEL_ENDPOINTS: Partial<Record<AIProviderId, string>> = {
  openai: 'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/models',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  xai: 'https://api.x.ai/v1/models',
  groq: 'https://api.groq.com/openai/v1/models',
  mistral: 'https://api.mistral.ai/v1/models',
  cohere: 'https://api.cohere.com/v1/models',
  deepseek: 'https://api.deepseek.com/v1/models',
  fireworks: 'https://api.fireworks.ai/inference/v1/models',
  togetherai: 'https://api.together.xyz/v1/models',
  cerebras: 'https://api.cerebras.ai/v1/models',
  perplexity: 'https://api.perplexity.ai/models',
  deepinfra: 'https://api.deepinfra.com/v1/openai/models',
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

function getStaticModels(selectedTemplateId: string, draft: CustomProviderDraft) {
  const template = getProviderTemplate(selectedTemplateId)
  if (template) return template.staticModels
  return uniqueModels([draft.defaultModel, 'gpt-4o-mini', 'gpt-4o', 'o4-mini'])
}

function getModelsEndpoint(providerId: ActiveProvider['providerId'], baseURL: string) {
  if (providerId.startsWith('custom:')) return `${normalizeBaseURL(baseURL)}/models`
  return MODEL_ENDPOINTS[providerId as AIProviderId]
}

async function fetchProviderModels(params: {
  providerId: ActiveProvider['providerId']
  baseURL: string
  apiKey: string
}) {
  const { providerId, baseURL, apiKey } = params
  const endpoint = getModelsEndpoint(providerId, baseURL)
  if (!endpoint) throw new Error('当前 provider 暂未提供模型列表接口')

  if (providerId === 'google') {
    const response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`)
    if (!response.ok) throw new Error(`Google model request failed: ${response.status}`)
    const data = await response.json() as { models?: Array<{ name?: string, supportedGenerationMethods?: string[] }> }
    return uniqueModels((data.models || [])
      .filter((item) => !item.supportedGenerationMethods || item.supportedGenerationMethods.includes('generateContent'))
      .map((item) => (item.name || '').replace(/^models\//, '')))
  }

  if (providerId === 'anthropic') {
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
  const [apiKeys, setApiKeys] = useState<AiAgentApiKeys>([])

  const [selectedProvider, setSelectedProvider] = useState<string>(DEFAULT_PROVIDER_TEMPLATE.id)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(DEFAULT_PROVIDER_TEMPLATE.defaultModel)
  const [models, setModels] = useState<string[]>(DEFAULT_PROVIDER_TEMPLATE.staticModels)
  const [fetchState, setFetchState] = useState<ModelFetchState>({ loading: false, error: '' })

  const [customDraft, setCustomDraft] = useState<CustomProviderDraft>({
    label: '',
    baseURL: 'https://api.example.com/v1',
    defaultModel: 'gpt-4o-mini',
  })

  const fetchTimer = useRef<number | null>(null)
  const isCustom = selectedProvider === CUSTOM_PROVIDER_VALUE

  const activeProvider = useMemo<ActiveProvider>(() => {
    const template = getProviderTemplate(selectedProvider)
    if (template) {
      return {
        providerId: template.id,
        providerLabel: template.label,
        baseURL: '',
        defaultModel: template.defaultModel,
        staticModels: template.staticModels,
      }
    }

    return {
      providerId: `custom:${slugify(customDraft.label)}`,
      providerLabel: customDraft.label.trim() || 'Custom Provider',
      baseURL: customDraft.baseURL.trim(),
      defaultModel: customDraft.defaultModel.trim() || 'gpt-4o-mini',
      staticModels: getStaticModels(selectedProvider, customDraft),
    }
  }, [selectedProvider, customDraft])

  useEffect(() => {
    getNormalizedAgents().then((value) => {
      setApiKeys(value)
    })
  }, [])

  const persistAgents = (next: AiAgentApiKeys) => {
    agentsStorage.setValue(next).then(() => {
      // Storage is the source of truth; consumers read the updated value on demand.
    })
  }

  const setAndPersistAgents = (updater: (prev: AiAgentApiKeys) => AiAgentApiKeys) => {
    setApiKeys((prev) => {
      const next = updater(prev)
      persistAgents(next)
      return next
    })
  }

  useEffect(() => {
    setModels(activeProvider.staticModels)
    setModel(activeProvider.defaultModel)
    setFetchState({ loading: false, error: '' })
  }, [activeProvider.providerId, activeProvider.defaultModel, isCustom])

  useEffect(() => {
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      setModels(activeProvider.staticModels)
      setFetchState({ loading: false, error: '' })
      return
    }

    if (activeProvider.providerId.startsWith('custom:') && !activeProvider.baseURL) {
      setModels(activeProvider.staticModels)
      setFetchState({ loading: false, error: 'Custom Provider 需要 baseURL 才能拉取模型列表' })
      return
    }

    if (fetchTimer.current) window.clearTimeout(fetchTimer.current)
    fetchTimer.current = window.setTimeout(async () => {
      try {
        setFetchState({ loading: true, error: '' })
        const fetchedModels = await fetchProviderModels({
          providerId: activeProvider.providerId,
          baseURL: activeProvider.baseURL,
          apiKey: trimmedKey,
        })
        if (fetchedModels.length > 0) {
          setModels(fetchedModels)
          setModel((prev) => fetchedModels.includes(prev) ? prev : fetchedModels[0])
        } else {
          setModels(activeProvider.staticModels)
        }
        setFetchState({ loading: false, error: '' })
      } catch (error) {
        setFetchState({
          loading: false,
          error: error instanceof Error ? error.message : '模型拉取失败，已回退静态列表',
        })
        setModels(activeProvider.staticModels)
      }
    }, 500)

    return () => {
      if (fetchTimer.current) window.clearTimeout(fetchTimer.current)
    }
  }, [activeProvider, apiKey])

  const canAddCustom = !isCustom || (
    customDraft.label.trim().length > 1
    && customDraft.baseURL.trim().length > 5
    && customDraft.defaultModel.trim().length > 1
  )
  const canAdd = Boolean(canAddCustom && apiKey.trim() && model.trim())

  const handleAddProvider = () => {
    if (!canAdd) return

    const uniqueSuffix = Date.now().toString(36).slice(-4)
    const providerId = isCustom
      ? `${activeProvider.providerId}-${uniqueSuffix}` as `custom:${string}`
      : activeProvider.providerId

    const newItem: AiAgentApiKey = {
      providerId,
      providerLabel: activeProvider.providerLabel,
      apiKey: apiKey.trim(),
      model: model.trim() || activeProvider.defaultModel,
      ...(isCustom ? { baseURL: normalizeBaseURL(activeProvider.baseURL) } : {}),
    }

    setAndPersistAgents((prev) => [...prev, newItem])
    setApiKey('')
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    setAndPersistAgents((prev) => {
      const reordered = Array.from(prev)
      const [removed] = reordered.splice(result.source.index, 1)
      reordered.splice(result.destination!.index, 0, removed)
      return reordered
    })
  }

  const updateItem = (index: number, patch: Partial<AiAgentApiKey>) => {
    setAndPersistAgents((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const removeProvider = (index: number) => {
    setAndPersistAgents((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <OptionSection>
      <HeadlingTitle>
        <KeyRound className="h-5 w-5 text-primary" />
        API Providers
      </HeadlingTitle>
      <Subtitle>
        Select a supported Vercel AI SDK provider, paste its API key, then choose the model Vocabify should try first.
      </Subtitle>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_minmax(320px,1fr)_220px_auto]">
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger>
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {AI_PROVIDER_TEMPLATES.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_PROVIDER_VALUE}>Custom Provider</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="text"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Paste API key"
          aria-label="Provider API key"
        />

        <Select value={model} onValueChange={setModel}>
          <SelectTrigger>
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleAddProvider}
          disabled={!canAdd}
          className="disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {isCustom ? (
        <div className="grid grid-cols-1 gap-2 border-l border-border/70 pl-3 md:grid-cols-[180px_minmax(320px,1fr)_220px]">
          <Input
            type="text"
            value={customDraft.label}
            onChange={(event) => setCustomDraft((prev) => ({ ...prev, label: event.target.value }))}
            placeholder="Custom provider name"
            aria-label="Custom provider name"
          />

          <Input
            type="text"
            value={customDraft.baseURL}
            onChange={(event) => setCustomDraft((prev) => ({ ...prev, baseURL: event.target.value }))}
            placeholder="OpenAI-compatible base URL"
            aria-label="Custom provider base URL"
          />

          <Input
            type="text"
            value={customDraft.defaultModel}
            onChange={(event) => setCustomDraft((prev) => ({ ...prev, defaultModel: event.target.value }))}
            placeholder="Default model"
            aria-label="Custom provider default model"
          />
        </div>
      ) : <></>}

      <div className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
        {fetchState.loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在拉取模型列表
          </>
        ) : fetchState.error ? (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            {fetchState.error}
          </>
        ) : (
          '模型列表会在输入 API key 后自动拉取；失败时回退到内置常用模型。'
        )}
      </div>

      {apiKeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-secondary/30 px-4 py-8 text-center text-[13px] text-muted-foreground">
          还没有 provider 配置，请先添加至少一个。
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="providers">
            {(provided) => (
              <ul ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2">
                {apiKeys.map((item, index) => {
                  const fallbackModels = uniqueModels([item.model, getProviderTemplate(item.providerId)?.defaultModel || '', 'gpt-4o-mini'])
                  return (
                    <Draggable key={`${item.providerId}-${item.model}-${index}`} draggableId={`${item.providerId}-${item.model}-${index}`} index={index}>
                      {(dragProvided, snapshot) => (
                        <li
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={cn(
                            'group/provider grid grid-cols-[32px_minmax(0,1fr)_36px] items-center gap-2 rounded-xl border border-border/70 bg-secondary/35 px-3 py-2 transition-[background-color,border-color,box-shadow] duration-150 hover:border-border hover:bg-secondary/55 md:grid-cols-[32px_96px_minmax(300px,1fr)_160px_36px]',
                            snapshot.isDragging && 'bg-card shadow-apple-lg',
                          )}
                        >
                          <span
                            {...dragProvided.dragHandleProps}
                            className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing"
                            aria-label="Drag to reorder"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>

                          <span className="min-w-0 truncate text-sm font-medium">{item.providerLabel}</span>

                          <Input
                            value={item.apiKey}
                            onChange={(event) => updateItem(index, { apiKey: event.target.value })}
                            placeholder="Enter API key"
                            className="col-span-2 font-mono text-[13px] md:col-span-1"
                            aria-label={`${item.providerLabel} API key`}
                          />

                          <Select value={item.model} onValueChange={(value) => updateItem(index, { model: value })}>
                            <SelectTrigger className="col-span-2 md:col-span-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {fallbackModels.map((modelValue) => (
                                <SelectItem key={modelValue} value={modelValue}>
                                  {modelValue}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProvider(index)}
                            aria-label={`Remove ${item.providerLabel}`}
                            className="text-muted-foreground transition-[color,background-color] duration-150 hover:!bg-destructive/10 hover:!text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      )}
                    </Draggable>
                  )
                })}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </OptionSection>
  )
}

export default ApiKeysConfigComponent
