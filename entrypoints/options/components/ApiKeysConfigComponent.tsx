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
  type AIProviderCategory,
  type AIProviderProtocol,
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

const CUSTOM_PROVIDER_VALUE = '__custom__'

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

function getInitialModels(protocol: AIProviderProtocol, selectedTemplateId: string, draft: CustomProviderDraft) {
  const template = getProviderTemplate(selectedTemplateId)
  if (template) return template.staticModels

  if (protocol === 'gemini-native') return ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']
  if (protocol === 'anthropic') return ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
  return uniqueModels([draft.defaultModel, 'gpt-4o-mini', 'gpt-4o', 'o4-mini'])
}

function getModelsEndpoint(protocol: AIProviderProtocol, baseURL: string) {
  const normalizedBaseURL = normalizeBaseURL(baseURL)

  if (protocol === 'gemini-native') {
    return `${normalizedBaseURL}/v1beta/models`
  }
  if (protocol === 'anthropic') {
    return `${normalizedBaseURL}/models`
  }
  return `${normalizedBaseURL}/models`
}

async function fetchProviderModels(params: {
  protocol: AIProviderProtocol
  baseURL: string
  apiKey: string
}) {
  const { protocol, baseURL, apiKey } = params
  const endpoint = getModelsEndpoint(protocol, baseURL)

  if (protocol === 'gemini-native') {
    const response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`)
    if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`)
    const data = await response.json() as { models?: Array<{ name?: string, supportedGenerationMethods?: string[] }> }
    const modelNames = (data.models || [])
      .filter((item) => item.supportedGenerationMethods?.includes('generateContent'))
      .map((item) => (item.name || '').replace(/^models\//, ''))
    return uniqueModels(modelNames)
  }

  if (protocol === 'anthropic') {
    const response = await fetch(endpoint, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!response.ok) throw new Error(`Anthropic request failed: ${response.status}`)
    const data = await response.json() as { data?: Array<{ id?: string }> }
    return uniqueModels((data.data || []).map((item) => item.id || ''))
  }

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
  if (!response.ok) throw new Error(`OpenAI-compatible request failed: ${response.status}`)
  const data = await response.json() as { data?: Array<{ id?: string }> }
  return uniqueModels((data.data || []).map((item) => item.id || ''))
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
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  })

  const fetchTimer = useRef<number | null>(null)
  const providerOptions = AI_PROVIDER_TEMPLATES
  const isCustom = selectedProvider === CUSTOM_PROVIDER_VALUE

  const activeProvider = useMemo(() => {
    const template = getProviderTemplate(selectedProvider)
    if (template) {
      return {
        providerId: template.id,
        providerLabel: template.label,
        category: template.category,
        protocol: template.protocol,
        baseURL: template.baseURL || '',
        defaultModel: template.defaultModel,
        staticModels: template.staticModels,
      }
    }

    return {
      providerId: `custom:${slugify(customDraft.label)}`,
      providerLabel: customDraft.label.trim() || 'Custom Provider',
      category: 'openai-compatible' as AIProviderCategory,
      protocol: 'openai-compatible' as AIProviderProtocol,
      baseURL: customDraft.baseURL.trim(),
      defaultModel: customDraft.defaultModel.trim() || 'gpt-4o-mini',
      staticModels: getInitialModels('openai-compatible', selectedProvider, customDraft),
    }
  }, [selectedProvider, customDraft])

  useEffect(() => {
    getNormalizedAgents().then((value) => {
      setApiKeys(value)
    })
  }, [])

  const persistAgents = (next: AiAgentApiKeys) => {
    agentsStorage.setValue(next).then(() => {
      browser.runtime.sendMessage({ from: 'popup', type: 'agents-changed' })
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
  }, [activeProvider.providerId, activeProvider.protocol, activeProvider.defaultModel, isCustom])

  useEffect(() => {
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      setModels(activeProvider.staticModels)
      setFetchState({ loading: false, error: '' })
      return
    }

    if (!activeProvider.baseURL) {
      setModels(activeProvider.staticModels)
      setFetchState({ loading: false, error: '缺少 baseURL，无法拉取模型列表' })
      return
    }

    if (fetchTimer.current) window.clearTimeout(fetchTimer.current)
    fetchTimer.current = window.setTimeout(async () => {
      try {
        setFetchState({ loading: true, error: '' })
        const fetchedModels = await fetchProviderModels({
          protocol: activeProvider.protocol,
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
      ? `${activeProvider.providerId}-${uniqueSuffix}`
      : activeProvider.providerId

    const newItem: AiAgentApiKey = {
      providerId,
      providerLabel: activeProvider.providerLabel,
      category: activeProvider.category,
      protocol: activeProvider.protocol,
      apiKey: apiKey.trim(),
      model: model.trim() || activeProvider.defaultModel,
      ...(activeProvider.baseURL ? { baseURL: normalizeBaseURL(activeProvider.baseURL) } : {}),
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
        Add provider credentials and choose the model Vocabify should use first.
      </Subtitle>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_minmax(320px,1fr)_220px_auto]">
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger>
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CUSTOM_PROVIDER_VALUE}>Custom Provider</SelectItem>
            {providerOptions.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
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
            placeholder="Base URL, e.g. https://api.example.com/v1"
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
      ) : (
        <></>
      )}

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
          '模型拉取失败时会自动回退为内置模型列表。'
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
