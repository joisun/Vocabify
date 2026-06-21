import { useEffect, useRef, useState } from "react"
import VocabifySvgIcon from "./VocabifySvgIcon.tsx"

export default function MockLoading() {
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      const timer2 = setTimeout(() => {
        loadingRef.current?.remove();
        clearTimeout(timer2);
      }, 200);
      clearTimeout(timer);
    }, 800);
  }, []);

  return (
    <div
      ref={loadingRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-500 ease-spring"
      style={{ opacity: loading ? 1 : 0, pointerEvents: loading ? "auto" : "none" }}
      aria-hidden={!loading}
    >
      <VocabifySvgIcon className="text-[48px] text-primary-foreground animate-ai-pulse" />
      <h1 className="font-display text-xl font-semibold tracking-tight">Vocabify</h1>
    </div>
  );
}
