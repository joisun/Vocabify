import { Sparkles } from "lucide-react";

export default function MockLoading() {
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      const timer2 = setTimeout(() => {
        loadingRef.current?.remove();
        clearTimeout(timer2);
      }, 600);
      clearTimeout(timer);
    }, 500);
  }, []);

  return (
    <div
      ref={loadingRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-500 ease-spring"
      style={{ opacity: loading ? 1 : 0, pointerEvents: loading ? "auto" : "none" }}
      aria-hidden={!loading}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-[hsl(211_100%_60%)] shadow-apple-md animate-spring-in">
        <Sparkles className="h-7 w-7 text-primary-foreground animate-ai-pulse" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Vocabify</h1>
    </div>
  );
}
