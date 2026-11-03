export function PageIntro({
  crumb,
  title,
  subtitle,
}: {
  crumb?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      {crumb && <p className="text-xs text-muted">{crumb}</p>}
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-[2rem]">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      <p className="mt-1 text-xs text-muted">Demo data · integrations not connected</p>
    </div>
  );
}
