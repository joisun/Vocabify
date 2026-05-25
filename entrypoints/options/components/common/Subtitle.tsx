export default function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground max-w-prose">
      {children}
    </p>
  )
}
