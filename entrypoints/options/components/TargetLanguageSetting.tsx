import { useEffect, useState } from 'react'
import { Languages } from 'lucide-react'
import HeadlingTitle from './common/HeadlingTitle'
import Subtitle from './common/Subtitle'
import OptionSection from './OptionSection'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { targetLanguage } from '@/utils/storage'
import { DefaultLanguage } from '@/const'
// 直接引入SVG文件
import us from '@/assets/flags/4x3/us.svg'
import es from '@/assets/flags/4x3/es.svg'
import cn_flag from '@/assets/flags/4x3/cn.svg'
import fr from '@/assets/flags/4x3/fr.svg'
import de from '@/assets/flags/4x3/de.svg'
import it from '@/assets/flags/4x3/it.svg'
import jp from '@/assets/flags/4x3/jp.svg'
import kr from '@/assets/flags/4x3/kr.svg'
import pt from '@/assets/flags/4x3/pt.svg'
import ru from '@/assets/flags/4x3/ru.svg'
import ar from '@/assets/flags/4x3/ar.svg'
import nl from '@/assets/flags/4x3/nl.svg'
import tr from '@/assets/flags/4x3/tr.svg'
import se from '@/assets/flags/4x3/se.svg'
import pl from '@/assets/flags/4x3/pl.svg'
import hu from '@/assets/flags/4x3/hu.svg'
import cz from '@/assets/flags/4x3/cz.svg'
import gr from '@/assets/flags/4x3/gr.svg'
import in_flag from '@/assets/flags/4x3/in.svg'
import vn from '@/assets/flags/4x3/vn.svg'

const languages = [
    { label: 'English', value: 'English', flag: us },
    { label: 'Spanish', value: 'Spanish', flag: es },
    { label: 'Chinese', value: 'Chinese', flag: cn_flag },
    { label: 'French', value: 'French', flag: fr },
    { label: 'German', value: 'German', flag: de },
    { label: 'Italian', value: 'Italian', flag: it },
    { label: 'Japanese', value: 'Japanese', flag: jp },
    { label: 'Korean', value: 'Korean', flag: kr },
    { label: 'Portuguese', value: 'Portuguese', flag: pt },
    { label: 'Russian', value: 'Russian', flag: ru },
    { label: 'Arabic', value: 'Arabic', flag: ar },
    { label: 'Dutch', value: 'Dutch', flag: nl },
    { label: 'Turkish', value: 'Turkish', flag: tr },
    { label: 'Swedish', value: 'Swedish', flag: se },
    { label: 'Polish', value: 'Polish', flag: pl },
    { label: 'Hungarian', value: 'Hungarian', flag: hu },
    { label: 'Czech', value: 'Czech', flag: cz },
    { label: 'Greek', value: 'Greek', flag: gr },
    { label: 'Hindi', value: 'Hindi', flag: in_flag },
    { label: 'Vietnamese', value: 'Vietnamese', flag: vn },
];

const TargetLanguageSetting = () => {
    const [selectedLanguage, setSelectedLanguage] = useState(DefaultLanguage)
    useEffect(() => {
        targetLanguage.getValue().then((storedVal) => {
            if (storedVal) setSelectedLanguage(storedVal);
        })
    }, [])

    const handleSelect = (value: string) => {
        targetLanguage.setValue(value);
        setSelectedLanguage(value)
    }

    const current = languages.find((l) => l.value === selectedLanguage);

    return (
        <OptionSection>
            <HeadlingTitle>
                <Languages className="h-5 w-5 text-primary" />
                Target Language
            </HeadlingTitle>
            <Subtitle>The language Vocabify will translate selected text into.</Subtitle>

            <Select value={selectedLanguage} onValueChange={handleSelect}>
                <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue>
                        <span className="flex items-center gap-2">
                            {current?.flag && (
                                <img className="h-4 w-6 rounded-sm object-cover ring-1 ring-border/50" src={current.flag} alt="" />
                            )}
                            <span className="font-medium">{selectedLanguage}</span>
                        </span>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {languages.map((language) => (
                        <SelectItem key={language.value} value={language.value}>
                            <div className="flex items-center gap-2">
                                <img
                                    className="h-4 w-6 rounded-sm object-cover ring-1 ring-border/50"
                                    src={language.flag}
                                    alt={`${language.label} flag`}
                                />
                                {language.label}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </OptionSection>
    )
}

export default TargetLanguageSetting
