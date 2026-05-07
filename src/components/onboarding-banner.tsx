"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, ChevronRight, X, Sparkles, FileText } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href: string;
}

interface OnboardingBannerProps {
  onboarding: {
    steps: OnboardingStep[];
    completedCount: number;
    totalSteps: number;
    isFinished: boolean;
  };
  guideUrl?: string | null;
}

export function OnboardingBanner({ onboarding, guideUrl }: OnboardingBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const dismissed = localStorage.getItem("onboarding_dismissed");
    if (!dismissed && !onboarding.isFinished) {
      setIsVisible(true);
    }
  }, [onboarding.isFinished]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("onboarding_dismissed", "true");
  };

  if (!hasMounted || !isVisible || onboarding.isFinished) return null;

  const progressPercentage = (onboarding.completedCount / onboarding.totalSteps) * 100;

  return (
    <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm dark:from-blue-950/20 dark:to-background dark:border-blue-900/50 mb-8">
      {/* Background Decoration */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-100/50 blur-3xl dark:bg-blue-900/20" />
      <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-indigo-100/50 blur-3xl dark:bg-indigo-900/20" />

      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                Panduan Awal: Siapkan Sistem Anda
              </h2>
            </div>
            <p className="text-sm text-blue-700/70 dark:text-blue-300/60">
              Selesaikan langkah-langkah berikut agar sistem Invoice SDC siap digunakan sepenuhnya.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {guideUrl && (
              <a
                href={guideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition-all hover:bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/40"
              >
                <FileText className="h-3.5 w-3.5" />
                Panduan PDF
              </a>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/50"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-blue-900 dark:text-blue-100">Progres Pengaturan</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {onboarding.completedCount} dari {onboarding.totalSteps} Selesai
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30">
              <div
                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {onboarding.steps.map((step) => (
              <Link
                key={step.id}
                href={step.href}
                className={cn(
                  "group relative flex items-start gap-3 rounded-xl border p-3 transition-all hover:shadow-md",
                  step.completed
                    ? "border-green-100 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/10"
                    : "border-blue-100 bg-white hover:border-blue-300 dark:border-blue-900/30 dark:bg-background"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {step.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-blue-300 group-hover:text-blue-500 dark:text-blue-800" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        step.completed
                          ? "text-green-900 line-through decoration-green-300 dark:text-green-100"
                          : "text-blue-900 dark:text-blue-100"
                      )}
                    >
                      {step.label}
                    </span>
                    {!step.completed && (
                      <ChevronRight className="h-3 w-3 text-blue-400 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{step.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
