import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ChevronsDown, ChevronsUp } from 'lucide-react'
import Editor from './Editor'

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'

export default function Records() {
  const PAGE_SIZE = 3
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(1)
  const [pageNum, setPageNum] = useState(1)

  const handleNavigate = async (isNext: boolean) => {
    let nextPageNum = 1
    if (isNext) {
      nextPageNum = pageNum + 1
    } else {
      nextPageNum = pageNum - 1
    }

    if (nextPageNum < 1 || nextPageNum > total) return

    setPageNum(nextPageNum)

    await findByPage(nextPageNum, PAGE_SIZE)
  }

  const findByPage = async (pageNum: number, pageSize: number) => {
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
      setRecords(response.message.records)
    }
  }

  useEffect(() => {
    findByPage(pageNum, PAGE_SIZE)
  }, [])

  return (
    <div>
      {records.map(({ wordOrPhrase, meaning }, index) => {
        return <Record wordOrPhrase={wordOrPhrase} meaning={meaning} key={index} />
      })}

      {/* <Button onClick={test}>{pageNum}/{total}</Button> */}
      <p className="text-center text-foreground/50">
        {pageNum}/{total}
      </p>
      <Pagination className="mt-2">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" onClick={() => handleNavigate(false)} />
          </PaginationItem>

          <PaginationItem>
            <PaginationNext href="#" onClick={() => handleNavigate(true)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
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

      <div className="mt-2 rounded-xl border bg-card text-card-foreground shadow px-2 pt-6 relative">
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

        {!expand && <p className="animate-fadeIn h-12 line-clamp-3" >{meaning.substring(0, 150)}</p>}

        <Button variant="ghost" className="w-full my-2 h-6 p-0" onClick={toggleExpand}>
          {expand ? <ChevronsUp className="animate-pulse" size="20" /> : <ChevronsDown className="animate-pulse" size="20" />}
        </Button>
      </div>
    </>
  )
}
