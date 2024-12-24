import { Loader } from "lucide-react";

export default function MockLoading() {
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      clearTimeout(timer);
      const timer2 = setTimeout(() => {
        loadingRef.current && loadingRef.current.remove();
        clearTimeout(timer2);
      }, 1000);
    }, 800);
  }, []);
  return (
    <div
      ref={loadingRef}
      className="container transition-all duration-1000 mx-auto max-w-4xl p-6 bg-background  flex flex-col justify-center items-center h-screen fixed inset-0 z-[9999]"
      style={{ opacity: loading ? 1 : 0 }}
    >
      <h1 className="mb-6 text-4xl font-semibold">Vocabify</h1>
      <div className="animate-spin">
        <Loader className="animate-scaleUp" />
      </div>
    </div>
  );
}
