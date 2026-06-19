export const Selection_Placeholder = '{SELECTION}'
export const Language_Placeholder = '{LANGUAGE}'
export const SourceContext_Placeholder = '{SOURCE_CONTEXT}'
export const DefaultLanguage = 'English'
export const DefaultPromptTemplate = `Analyze the selected vocabulary item: ${Selection_Placeholder}
Target language: ${Language_Placeholder}
Source context: ${SourceContext_Placeholder}

Use source context to choose the most likely meaning.
Prefer concise explanations.`

export const NO_SELECTION_CONTAINER = 'vocabify-no-selection'
