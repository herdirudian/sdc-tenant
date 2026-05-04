import Link from "next/link";

import { getAgingCollection } from "@/actions/collection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateID, formatIDR } from "@/lib/format";
import { requireRole, requireSubscription } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

function bucketBadge(bucket: string) {
  if (bucket === "31-60") return <Badge variant="secondary">31-60</Badge>;
  if (bucket === "61-90") return <Badge variant="warning">61-90</Badge>;
  if (bucket === "90+") return <Badge variant="danger">90+</Badge>;
  return <Badge variant="muted">0-30</Badge>;
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireSubscription();
  await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const { tab } = await searchParams;
  const data = await getAgingCollection();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueSoonEnd = new Date(today);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 7);

  const filtered = data.items.filter((it) => {
    if (tab === "overdue") return it.daysOverdue > 0;
    if (tab === "dueSoon") return it.dueDate && new Date(it.dueDate) >= today && new Date(it.dueDate) <= dueSoonEnd;
    if (tab === "followUp") return it.nextFollowUpAt && new Date(it.nextFollowUpAt) <= today;
    if (tab === "0-30" || tab === "31-60" || tab === "61-90" || tab === "90+") return it.bucket === tab;
    return true;
  });

  const totalOutstanding = filtered.reduce((acc, it) => acc + it.outstanding, 0);

  const tabLink = (t?: string) => (t ? `/collections?tab=${encodeURIComponent(t)}` : "/collections");

  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Collections</CardTitle>
            <CardDescription>Aging piutang dan follow-up penagihan.</CardDescription>
          </div>
          <Link href="/">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </CardHeader>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { id: "0-30", label: "0-30 Days", variant: "muted" },
          { id: "31-60", label: "31-60 Days", variant: "secondary" },
          { id: "61-90", label: "61-90 Days", variant: "warning" },
          { id: "90+", label: "> 90 Days", variant: "danger" },
        ].map((b) => {
          const stats = data.totals[b.id] || { count: 0, sum: 0 };
          const isActive = tab === b.id;
          return (
            <Link key={b.id} href={tabLink(b.id)}>
              <Card className={`transition-colors hover:bg-muted/50 ${isActive ? "border-primary ring-1 ring-primary" : ""}`}>
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-wider">{b.label}</CardDescription>
                    <Badge variant={b.variant as any}>{stats.count}</Badge>
                  </div>
                  <CardTitle className="text-xl">{formatIDR(stats.sum)}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-[10px] text-muted-foreground">
                    {stats.count} unpaid invoice(s)
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={tabLink(undefined)}>
          <Button variant={tab ? "outline" : "default"}>All</Button>
        </Link>
        <Link href={tabLink("overdue")}>
          <Button variant={tab === "overdue" ? "default" : "outline"}>Overdue</Button>
        </Link>
        <Link href={tabLink("dueSoon")}>
          <Button variant={tab === "dueSoon" ? "default" : "outline"}>Due ≤ 7d</Button>
        </Link>
        <Link href={tabLink("followUp")}>
          <Button variant={tab === "followUp" ? "default" : "outline"}>Follow-up due</Button>
        </Link>
        <Link href={tabLink("0-30")}>
          <Button variant={tab === "0-30" ? "default" : "outline"}>0-30</Button>
        </Link>
        <Link href={tabLink("31-60")}>
          <Button variant={tab === "31-60" ? "default" : "outline"}>31-60</Button>
        </Link>
        <Link href={tabLink("61-90")}>
          <Button variant={tab === "61-90" ? "default" : "outline"}>61-90</Button>
        </Link>
        <Link href={tabLink("90+")}>
          <Button variant={tab === "90+" ? "default" : "outline"}>90+</Button>
        </Link>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {filtered.length} invoice(s) • Total outstanding {formatIDR(totalOutstanding)}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Bucket</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Next Follow-up</TableHead>
            <TableHead>Last Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((it) => (
            <TableRow key={it.id}>
              <TableCell className="font-medium">
                <Link className="hover:underline" href={`/invoices/${it.id}`}>
                  {it.invoiceNumber}
                </Link>
                {it.projectName ? (
                  <div className="text-xs text-muted-foreground">{it.projectName}</div>
                ) : null}
              </TableCell>
              <TableCell>{it.clientName}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {bucketBadge(it.bucket)}
                  <span className="text-xs text-muted-foreground">{it.daysOverdue}d</span>
                </div>
              </TableCell>
              <TableCell>{formatDateID(it.dueDate)}</TableCell>
              <TableCell className="text-right">{formatIDR(it.outstanding)}</TableCell>
              <TableCell>{formatDateID(it.nextFollowUpAt)}</TableCell>
              <TableCell className="max-w-[420px]">
                {it.lastFollowUp ? (
                  <div className="text-sm">
                    <div className="truncate">{it.lastFollowUp.note}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.lastFollowUp.actor} • {formatDateID(it.lastFollowUp.createdAt)}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                Nothing to show.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

