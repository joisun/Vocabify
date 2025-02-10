import { toast } from 'sonner'

async function detectLanguage(text: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`
  const response = await fetch(url)
  const data = await response.json()
  return data[2] // 返回检测出的语言代码，如 "zh-CN"、"en"
}

async function speakGoogleTTS(text: string) {
  const lang = await detectLanguage(text) // 自动检测语言
  console.log(`检测到语言: ${lang}`)

  const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`
  const audio = new Audio(audioUrl)
  await new Promise<void>((resolve: any) => {
    audio.onended = resolve
    audio.play()
  })
}

export async function speak(text: string, setLoading: (loading: boolean) => void) {
  try {
    setLoading(true)
    await speakGoogleTTS(text)
  } catch (error) {
    toast('Speak Failed for Google TTS😱', {
      description: 'Speak need Google Service, Please check your network.',
    })
    console.error('Error in TTS:', error)
  } finally {
    setLoading(false)
  }
}
