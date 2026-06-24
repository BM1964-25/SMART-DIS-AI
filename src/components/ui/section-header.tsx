type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-normal text-foreground">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
