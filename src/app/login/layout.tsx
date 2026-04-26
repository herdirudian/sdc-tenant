export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <img src="/icon.png" alt="Solusi Digital Creative" className="h-24 w-auto" />
          <div>
            <div className="text-xl font-bold tracking-tight">PT Solusi Digital Creative</div>
            <div className="text-sm text-muted-foreground">Internal Management System</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
