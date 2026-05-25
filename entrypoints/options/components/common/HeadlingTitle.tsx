export default function HeadlingTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display flex items-center gap-2 text-[19px] font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  )
}
