import { ThemeProvider } from "@/components/theme-provider";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <div className="light" style={{ colorScheme: "light" }}>
        {children}
      </div>
    </ThemeProvider>
  );
}
