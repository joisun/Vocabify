import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Save, X } from 'lucide-react'
import type { PosType } from '@/lib/vocabTypes'

export interface EditableFields {
  term: string
  phonetic: string
  pos: PosType
  senses: Array<{ definition: string; example: string; exampleTranslation: string }>
  mnemonic: string
}

interface RecordEditFormProps {
  initial: Partial<EditableFields>
  saving?: boolean
  formId?: string
  hideActions?: boolean
  onCommit: (fields: EditableFields) => void
  onCancel: () => void
}

export function RecordEditForm({ initial, saving, formId, hideActions = false, onCommit, onCancel }: RecordEditFormProps) {
  const [term, setTerm] = useState(initial.term || '')
  const [phonetic, setPhonetic] = useState(initial.phonetic || '')
  const [pos, setPos] = useState<PosType>(initial.pos || 'other')
  const [mnemonic, setMnemonic] = useState(initial.mnemonic || '')
  const [senses, setSenses] = useState<EditableFields['senses']>(
    (initial.senses || []).map((s) => ({
      definition: s.definition || '',
      example: s.example || '',
      exampleTranslation: s.exampleTranslation || '',
    })),
  )

  function updateSense(idx: number, patch: Partial<EditableFields['senses'][number]>) {
    setSenses((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }
  function addSense() {
    if (senses.length >= 3) return
    setSenses([...senses, { definition: '', example: '', exampleTranslation: '' }])
  }
  function removeSense(idx: number) {
    if (senses.length <= 1) return
    setSenses(senses.filter((_, i) => i !== idx))
  }
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !term.trim() || senses.length === 0) return
    onCommit({ term, phonetic, pos, senses, mnemonic })
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <div className="grid grid-cols-[1fr_100px_70px] gap-2">
        <Field label="Term">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} className="h-8 text-[12px]" />
        </Field>
        <Field label="Phonetic">
          <Input value={phonetic} onChange={(e) => setPhonetic(e.target.value)} placeholder="/.../" className="h-8 text-[12px]" />
        </Field>
        <Field label="POS">
          <select
            value={pos}
            onChange={(e) => setPos(e.target.value as PosType)}
            className="h-8 w-full rounded-md border border-input bg-card px-2 text-[12px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:border-ring/50 dark:border-white/[0.04] dark:bg-surface dark:focus-visible:ring-white/12 dark:focus-visible:border-white/10"
          >
            {(['n', 'v', 'adj', 'adv', 'phrase', 'other'] as PosType[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Senses ({senses.length}/3)
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={addSense} disabled={senses.length >= 3} className="h-6 px-1.5 text-[11px]">
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>

        {senses.map((sense, i) => (
          <div key={i} className="rounded-[5px] border border-border/60 bg-secondary/40 p-2 space-y-1.5 dark:border-white/[0.04] dark:bg-white/[0.025]">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-primary">{`①②③`[i] || i + 1}</span>
              {senses.length > 1 && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSense(i)} className="ml-auto h-5 w-5 text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Input value={sense.definition} placeholder="Definition" onChange={(e) => updateSense(i, { definition: e.target.value })} className="h-7 text-[12px]" />
            <Input value={sense.example} placeholder="Example" onChange={(e) => updateSense(i, { example: e.target.value })} className="h-7 text-[12px]" />
            <Input value={sense.exampleTranslation} placeholder="Translation" onChange={(e) => updateSense(i, { exampleTranslation: e.target.value })} className="h-7 text-[12px]" />
          </div>
        ))}
      </div>

      <Field label="Mnemonic">
        <Textarea value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} rows={2} className="text-[12px]" />
      </Field>

      {!hideActions ? (
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="h-7 px-3 text-[12px]">
            取消
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={saving || !term.trim() || senses.length === 0}
            className="h-7 px-3 text-[12px]"
          >
            {saving ? '…' : <><Save className="h-3.5 w-3.5" /> 保存</>}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
