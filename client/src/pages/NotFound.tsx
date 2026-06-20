import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-card/90 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
          <AlertCircle className="size-7 text-primary" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">404</p>
        <h1 className="mt-4 font-display text-4xl font-light tracking-tight">Page not found</h1>
        <p className="mx-auto mt-4 max-w-sm leading-7 text-muted-foreground">
          The route you are looking for is not part of the active JIMMI rebuild.
        </p>
        <Button
          onClick={handleGoHome}
          className="mt-8 rounded-full bg-primary px-6 py-2.5 text-primary-foreground hover:bg-primary/90"
        >
          <Home className="mr-2 size-4" />
          Go Home
        </Button>
      </section>
    </main>
  );
}
