export default function Subtitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-xs text-left w-fit text-foreground/80 px-1 rounded-lg font-thin mb-2">{children}</h3>
    )
}
