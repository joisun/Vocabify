import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { firstCheckRecord, recordPageSize } from '@/utils/storage'
import { ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Search, XIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import Editor from './Editor'
export default function Records() {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(1)
  const [pageNum, setPageNum] = useState(1)
  const [onSearch, setOnSearch] = useState(false)
  const [searchText, setSearchText] = useState('')

  const handleNavigate = async (isNext: boolean) => {
    let nextPageNum = isNext ? pageNum + 1 : pageNum - 1
    if (nextPageNum < 1 || nextPageNum > total) return

    setPageNum(nextPageNum)

    await findByPage(nextPageNum)
  }

  const findByPage = async (pageNum: number) => {
    const pageSize = (await recordPageSize.getValue()) || 5
    const response = await chrome.runtime.sendMessage({
      action: 'findByPage',
      payload: {
        pageNum: pageNum,
        pageSize: pageSize,
      },
    })
    if (response.status === 'success') {
      const total = response.message.total
      setTotal(total)
      setRecords(response.message.records || [])
    }
  }

  const handleSearch = async (e: any) => {
    setSearchText(e.target.value)

    setOnSearch(true)
    if (e.target.value.trim() === '') {
      setOnSearch(false)
      await findByPage(1)
      return
    }

    await fuzzySearchByKeyword(searchText)
  }
  const handleClear = async () => {
    setOnSearch(false)
    setSearchText('')
    await findByPage(1)
  }
  const fuzzySearchByKeyword = async (keyword: string) => {
    const response = await chrome.runtime.sendMessage({
      action: 'fuzzySearchByKeyword',
      payload: keyword,
    })
    if (response.status === 'success') {
      const total = response.message.total
      setTotal(total)
      setRecords(response.message || [])
    }
  }
  const MessageHandler = {
    checkWord: async (payload: any) => {
      setSearchText(payload)
      await fuzzySearchByKeyword(payload)
    },
  }
  useEffect(() => {
    const messageListener = async (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      const { payload } = message
      const action = message.action as keyof typeof MessageHandler
      MessageHandler[action] && MessageHandler[action](payload)
    }
    chrome.runtime.onMessage.addListener(messageListener)

    // side panel 首次初始化的时候，去检查 firstCheckWord 中有没有用户待查询，如果有，取出执行
    firstCheckRecord.getValue().then(async (firstCheckRecordData) => {
      if (!firstCheckRecordData.trim()) {
        findByPage(pageNum)
      } else {
        await MessageHandler.checkWord(firstCheckRecordData)
        // 执行完毕后删除缓存值
        firstCheckRecord.removeValue()
      }
    })

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  return (
    <div className="h-[calc(100vh-5rem)] relative">
      <div className="relative w-full">
        <Search className="absolute left-0 top-0 m-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="px-9" placeholder="Search here..." value={searchText} onChange={handleSearch} />
        <Button
          onClick={handleClear}
          variant="link"
          size="icon"
          className="absolute hover:text-foreground cursor-pointer right-0 top-0 m-2.5 h-4 w-4 rounded-full text-muted-foreground"
        >
          <XIcon />
        </Button>
      </div>

      <div className="h-[calc(100vh-10rem)] overflow-auto scrollbar-tiny pr-1">
        {records.map(({ wordOrPhrase, meaning }, index) => {
          return <Record wordOrPhrase={wordOrPhrase} meaning={meaning} key={index} />
        })}
      </div>

      {!onSearch && (
        <section className="absolute bottom-0 w-full">
          <div className="row-1 flex justify-between items-center">
            <Button variant="ghost" onClick={() => handleNavigate(false)} disabled={pageNum === 1}>
              <ChevronLeft />
              Previous
            </Button>
            <p className="text-center text-foreground/50">
              {pageNum}/{total}
            </p>
            <Button variant="ghost" onClick={() => handleNavigate(true)} disabled={pageNum === total}>
              <ChevronRight />
              Next
            </Button>
          </div>
          <div className="row2 text-right"></div>
        </section>
      )}
    </div>
  )
}

function Record({ wordOrPhrase, meaning }: { wordOrPhrase: string; meaning: string }) {
  const [expand, setExpand] = useState(false)
  const toggleExpand = () => {
    setExpand(!expand)
  }

  return (
    <>
      {/* <MockLoading /> */}

      <div className="mt-2 rounded-xl border bg-card text-card-foreground shadow px-2 pt-1 relative">
        <Label>
          <span className="text-lg bg-gradient-to-b  from-transparent from-70% via-[percentage:70%_70%] via-indigo-600/80  to-indigo-600/80">
            {wordOrPhrase}
          </span>
        </Label>

        <div className={cn('grid my-1 transition-all duration-700 ease-in-out grid-rows-[0fr]', expand ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
          <div className="overflow-hidden">
            {/* <div>{meaning}</div> */}
            <Editor Record={{ wordOrPhrase, meaning }} />
          </div>
        </div>

        {!expand && <p className="animate-fadeIn  line-clamp-3">{meaning.substring(0, 150)}</p>}

        <Button variant="ghost" className="w-full my-2 h-6 p-0" onClick={toggleExpand}>
          {expand ? <ChevronsUp className="animate-pulse" size="20" /> : <ChevronsDown className="animate-pulse" size="20" />}
        </Button>
      </div>
    </>
  )
}
