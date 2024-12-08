import { targetLanguage, promptTemplate } from "@/utils/storage";
import { Language_Placeholder, Selection_Placeholder } from "@/const";

export default async function preprocessMsg(selection: string) {
  try {
    const language = await targetLanguage.getValue();
    const prompt = await promptTemplate.getValue();

    const selectionRegex = new RegExp(Selection_Placeholder, "g");
    const languageRegex = new RegExp(Language_Placeholder, "g");

    const processedResult = prompt
      .replace(languageRegex, language)
      .replace(selectionRegex, selection);
    return processedResult;
  } catch (err) {
    console.error(err);
  }
}
