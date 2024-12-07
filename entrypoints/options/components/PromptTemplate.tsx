import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from "sonner"
import HeadlingTitle from "./common/HeadlingTitle";
import Subtitle from './common/Subtitle';
import OptionSection from "./OptionSection";
import { promptTemplate } from '@/utils/storage';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

const Selection_Placeholder = '#SELECTION#'
const Language_Placeholder = '#LANGUAGE#'
const defaultTemplate = `
Please explain the following vocabulary word or phrase in ${Language_Placeholder} and format the response as follows:

**Word Or Phrase**:  ${Selection_Placeholder}

**Format requirements**:
1. First line: Show the word name, pronunciation, and part of speech, separated by a vertical bar |. Use emojis appropriately to enhance readability and fun.
2. Second line: Provide a simple definition of the word.
3. Provide two or three example sentences to show how the word is used in context.

**Formatting guidelines**:
- Use relevant emojis that represent the meaning of the word, such as 🐱 for "cat", 💬 for "say", etc.
- Keep the language simple and easy to read.
- Add emojis where appropriate to make the explanation more engaging.        
    `

const PromptTemplate = () => {
    const [inputValue, setInputValue] = useState<string>(defaultTemplate);
    useEffect(() => {
        promptTemplate.getValue().then(storedVal => {
            if (storedVal) {
                setInputValue(storedVal)
            } else {
                promptTemplate.setValue(inputValue)
            }
        })
    }, [])

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(event.target.value);
    };

    const handleSave = () => {
        promptTemplate.setValue(inputValue).then(res => {
            console.log('res', res)
            toast("Done🎉🎉🎉", {
                description: "Save custom prompt template successfully.",
            })
        }).catch(err => {
            toast("Failed😱😱😱", {
                description: "Save custom prompt template failed.",
            })
        })
        // Process save logic, e.g., send data to the server or update state
    };

    const handleReset = () => {
        setInputValue(defaultTemplate);
        promptTemplate.setValue(defaultTemplate).then(res => {
            console.log('res', res)
            toast("Reset Done♻️", {
                description: "Prompt has been reset to default.",
            })
        }).catch(err => {
            toast("Failed🤔🤔🤔", {
                description: "Something happend suddenly. You might try to reload the extention and try again.",
            })
        })
    }

    // Check if Selection_Placeholder exists in the input text
    const hasSelectionPlaceholder = inputValue.includes(Selection_Placeholder);

    // Check if Language_Placeholder exists in the input text
    const hasLanguagePlaceholder = inputValue.includes(Language_Placeholder);


    return (
        <OptionSection>
            <HeadlingTitle>Prompt Template</HeadlingTitle>
            <Subtitle>{`You can customize the prompt by replacing the selected words with ${Selection_Placeholder} and the language with ${Language_Placeholder} as placeholders.`}</Subtitle>

            {/* Render the highlighted text with #SELECTION# */}
            <div className="relative">
                <Textarea
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="请输入您的内容"
                    rows={15}
                    className="w-full mt-2" // Adjust width as needed
                />
            </div>

            {/* Save Button with Tooltip */}
            <TooltipProvider>
                <Tooltip open>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={handleSave}
                            className="mt-2"
                            disabled={!hasSelectionPlaceholder || !hasLanguagePlaceholder}
                        >
                            Save
                        </Button>
                    </TooltipTrigger>
                    {(!hasSelectionPlaceholder || !hasLanguagePlaceholder) &&
                        <TooltipContent side='bottom' align='start' className='bg-destructive text-destructive-foreground'>
                            <p>{`Please include ${(!hasSelectionPlaceholder && !hasLanguagePlaceholder) ? `${Selection_Placeholder} and ${Language_Placeholder}` :
                                !hasSelectionPlaceholder ? Selection_Placeholder : Language_Placeholder
                                } in your prompt.`}</p>
                        </TooltipContent>
                    }
                </Tooltip>
            </TooltipProvider>

            <Button
                variant='outline'
                onClick={handleReset}
                className="mt-2 ml-4"
            >
                Reset to default prompt
            </Button>

        </OptionSection>
    );
};

export default PromptTemplate;
