"use client";

import { useState } from "react";
import { ExternalLink, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generatePortalToken } from "@/actions/client";

interface PortalManagerProps {
  clientId: string;
  initialToken: string | null;
  baseUrl: string;
}

export function PortalManager({ clientId, initialToken, baseUrl }: PortalManagerProps) {
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const portalUrl = token ? `${baseUrl}/portal/${token}` : null;
  const relativeUrl = token ? `/portal/${token}` : null;

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await generatePortalToken(clientId);
      if (result.ok && result.token) {
        setToken(result.token);
      } else {
        alert("Gagal generate token: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Portal</CardTitle>
        <CardDescription>
          Provide client with a unique link to view their invoices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {token ? (
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Portal Link</Label>
              <div className="flex gap-2">
                <Input value={portalUrl || ""} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyToClipboard} title="Copy Link">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                {relativeUrl && (
                  <a href={relativeUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with the client so they can see all their invoices.
            </p>
            <Button 
              variant="outline" 
              className="w-full gap-2 text-xs" 
              onClick={handleGenerate}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Regenerating..." : "Regenerate Link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-center py-4">
            <p className="text-sm text-muted-foreground">
              No portal link generated yet.
            </p>
            <Button 
              className="w-full" 
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Portal Link"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
