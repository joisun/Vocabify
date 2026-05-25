import MockLoading from "@/components/custom/MockLoading";
import { Sparkles } from "lucide-react";
import ApiKeysConfigComponent from "./components/ApiKeysConfigComponent";
import PromptTemplate from "./components/PromptTemplate";
import TargetLanguageSetting from "./components/TargetLanguageSetting";
import UserInterfaceSettings from "./components/UserInterfaceSettings";

function App() {
  return (
    <>
      <MockLoading />

      <div className="min-h-screen bg-background text-foreground">
        {/* Translucent header bar (mimics macOS / iOS Settings) */}
        <header className="sticky top-0 z-30 glass border-b border-border/60">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
            <div
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(211_100%_60%)] shadow-apple-sm"
            >
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <h1 className="font-display text-[15px] font-semibold tracking-tight">
                Vocabify
              </h1>
              <p className="text-[12px] text-muted-foreground">
                Settings
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-8 pb-32 space-y-6">
          <ApiKeysConfigComponent />
          <TargetLanguageSetting />
          <PromptTemplate />
          <UserInterfaceSettings />
        </main>
      </div>
    </>
  );
}

export default App;
