export const Selection_Placeholder = "#SELECTION#";
export const Language_Placeholder = "#LANGUAGE#";
export const DefaultLanguage = "English";
export const DefaultPromptTemplate = `
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
    `;
