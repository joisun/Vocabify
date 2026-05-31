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

      <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_8%,hsl(var(--primary)/0.14),transparent_28%),radial-gradient(circle_at_86%_4%,rgba(255,255,255,0.92),transparent_30%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--secondary)/0.78))] text-foreground dark:bg-[radial-gradient(circle_at_12%_8%,hsl(var(--primary)/0.16),transparent_30%),radial-gradient(circle_at_86%_4%,rgba(255,255,255,0.08),transparent_32%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--secondary)/0.52))]">
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.26)_38%,transparent_56%)] opacity-70 dark:opacity-20" />

        <header className="sticky top-0 z-30 border-b border-white/20 bg-white/[0.38] shadow-[0_1px_0_rgba(255,255,255,0.26)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
            <div
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/30 bg-white/[0.32] text-primary shadow-apple-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.10]"
            >
              <Sparkles className="h-4 w-4" />
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

        <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-6 py-8 pb-32">
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
