import HeadlingTitle from './common/HeadlingTitle'
import OptionSection from './OptionSection'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus, Minus } from 'lucide-react'
import { recordPageSize } from '@/utils/storage'

export default function UserInterfaceSettings() {
  return (
    <OptionSection>
      <HeadlingTitle>UI Settings</HeadlingTitle>
      <div className="grid grid-cols-2 justify-items-start">
        <PageSizeSetter />
      </div>
    </OptionSection>
  )
}

const PageSizeSetter = ({ ...props }) => {
  const [pageSize, setPageSize] = useState(3)
  const handleSetPageSize = (isIncrement: boolean) => {
    const newPageSize = isIncrement ? pageSize + 1 : pageSize - 1 > 0 ? pageSize - 1 : pageSize
    setPageSize(newPageSize)
    recordPageSize.setValue(newPageSize)
  }

  useEffect(() => {
    recordPageSize.getValue().then((res) => {
      res && setPageSize(res)
    })
  }, [])
  return (
    <div className={cn('flex items-center justify-center space-x-2 mt-2', props.className)}>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Records Page Size：</label>
      <Button className="" variant="ghost" size="icon" onClick={() => handleSetPageSize(false)}>
        <Minus />
      </Button>
      <span className="mx-1">{pageSize}</span>
      <Button className="" variant="ghost" size="icon" onClick={() => handleSetPageSize(true)}>
        <Plus />
      </Button>
    </div>
  )
}
