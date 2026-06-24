export const Selection_Placeholder = '{SELECTION}'
export const Language_Placeholder = '{LANGUAGE}'
export const SourceContext_Placeholder = '{SOURCE_CONTEXT}'
export const DefaultLanguage = 'English'
export const DefaultPromptTemplate = `Selected text: ${Selection_Placeholder}
Target language: ${Language_Placeholder}
Source context: ${SourceContext_Placeholder}

Determine whether the selected text is a single word, a phrase, or a complete sentence.

If it is a single word:
- Explain the word's most likely meaning in the source context.
- Prefer the direct ${Language_Placeholder} meaning first.
- Keep the explanation concise.

If it is a phrase or sentence:
- Translate the entire selected text as one complete unit into ${Language_Placeholder}.
- Do not extract, replace, or explain any sub-term from the selected text.
- Use source context only to choose the most natural translation.

Return the result for the selected text itself only.`

export const NO_SELECTION_CONTAINER = 'vocabify-no-selection'
