import React, { useState, useEffect } from 'react'
import { db, type VocabRecord } from '@/lib/vocabifyDb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Trash2, Search } from 'lucide-react'

export function VocabList() {
  const [records, setRecords] = useState<VocabRecord[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadRecords()
  }, [])

  async function loadRecords() {
    setLoading(true)
    try {
      const allRecords = await db.records.orderBy('updatedAt').reverse().toArray()
      setRecords(allRecords)
    } catch (error) {
      console.error('Failed to load records:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!searchKeyword.trim()) {
      loadRecords()
      return
    }

    setLoading(true)
    try {
      const lowerKeyword = searchKeyword.toLowerCase()
      const results = await db.records
        .filter(r => r.wordOrPhrase.includes(lowerKeyword))
        .toArray()
      setRecords(results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await db.records.delete(id)
      setRecords(records.filter(r => r.id !== id))
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex gap-2">
        <Input
          placeholder="Search vocabulary..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No records found</div>
        ) : (
          records.map((record) => (
            <Card key={record.id} className="p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{record.wordOrPhrase}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{record.meaning}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Updated: {new Date(record.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => record.id && handleDelete(record.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
