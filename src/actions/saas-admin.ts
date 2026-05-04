"use server";

import { prisma } from "@/lib/prisma";
import { setSessionCookie, createSession, getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRole, SubscriptionStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function requireSystemAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  
  const ownerEmail = process.env.ADMIN_EMAIL || "admin@sdc.local";
  if (session.user.email !== ownerEmail) {
    return null; // Return null instead of redirecting immediately to allow checking
  }
  
  return session.user;
}

export async function isSystemAdmin() {
  const user = await requireSystemAdmin();
  return !!user;
}

export async function getTenantsList(params: { 
  q?: string; 
  status?: string; 
  page?: number 
}) {
  const user = await requireSystemAdmin();
  if (!user) redirect("/?error=unauthorized_saas_admin");
  
  const pageSize = 20;
  const page = params.page || 1;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (params.q) {
    where.name = { contains: params.q };
  }
  if (params.status && params.status !== "ALL") {
    where.subscription = { status: params.status };
  }

  const [tenants, totalCount] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        subscription: true,
        _count: {
          select: { users: true }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.tenant.count({ where }),
  ]);

  return {
    tenants,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
  };
}

export async function getTenantDetail(tenantId: string) {
  const user = await requireSystemAdmin();
  if (!user) redirect("/?error=unauthorized_saas_admin");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true,
      users: {
        orderBy: { createdAt: "asc" }
      },
      _count: {
        select: {
          invoices: true,
          projects: true,
          clients: true,
          expenses: true,
        }
      }
    }
  });

  if (!tenant) throw new Error("Tenant not found");
  return tenant;
}

export async function updateTenantSubscriptionManual(formData: FormData) {
  const user = await requireSystemAdmin();
  if (!user) redirect("/?error=unauthorized_saas_admin");

  const tenantId = formData.get("tenantId") as string;
  const status = formData.get("status") as SubscriptionStatus;
  const expiresAtStr = formData.get("expiresAt") as string;

  await prisma.subscription.upsert({
    where: { tenantId },
    update: {
      status,
      expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
    },
    create: {
      tenantId,
      status,
      expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
    }
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function impersonateUser(userId: string) {
  const userAdmin = await requireSystemAdmin();
  if (!userAdmin) redirect("/?error=unauthorized_saas_admin");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const session = await createSession(user.id);
  await setSessionCookie(session);

  redirect("/");
}

export async function getGlobalSettings() {
  const settings = await prisma.globalSettings.findUnique({
    where: { id: "system" }
  });

  if (settings) return settings;

  // Create default settings if not exists
  return prisma.globalSettings.create({
    data: {
      id: "system",
      maintenanceMode: false,
      subscriptionPrice: 100000,
      trialDays: 3,
    }
  });
}

export async function updateGlobalSettings(formData: FormData) {
  const user = await requireSystemAdmin();
  if (!user) redirect("/?error=unauthorized_saas_admin");

  const maintenanceMode = formData.get("maintenanceMode") === "on";
  const announcementTitle = formData.get("announcementTitle") as string;
  const announcementText = formData.get("announcementText") as string;
  const subscriptionPrice = parseFloat(formData.get("subscriptionPrice") as string);
  const trialDays = parseInt(formData.get("trialDays") as string);

  await prisma.globalSettings.update({
    where: { id: "system" },
    data: {
      maintenanceMode,
      announcementTitle: announcementTitle || null,
      announcementText: announcementText || null,
      subscriptionPrice: isNaN(subscriptionPrice) ? 100000 : subscriptionPrice,
      trialDays: isNaN(trialDays) ? 3 : trialDays,
    }
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function getGlobalAuditLogs(params: { q?: string; page?: number }) {
  const user = await requireSystemAdmin();
  if (!user) redirect("/?error=unauthorized_saas_admin");

  const pageSize = 50;
  const page = params.page || 1;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (params.q) {
    where.OR = [
      { actorUser: { name: { contains: params.q } } },
      { actorUser: { email: { contains: params.q } } },
      { entityId: { contains: params.q } },
    ];
  }

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actorUser: true,
        tenant: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
  };
}

export async function getDatabaseHealth() {
  await requireSystemAdmin();

  // 1. Table sizes (MySQL specific query)
  const tableStats = await prisma.$queryRaw`
    SELECT 
      table_name AS "tableName", 
      round(((data_length + index_length) / 1024 / 1024), 2) AS "sizeMB",
      table_rows AS "rowCount"
    FROM information_schema.TABLES 
    WHERE table_schema = DATABASE()
    ORDER BY (data_length + index_length) DESC
  ` as any[];

  // 2. Server Uptime & Memory (Node process info)
  const uptime = process.uptime(); // in seconds
  const memoryUsage = process.memoryUsage();

  return {
    tableStats,
    uptime,
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    }
  };
}

export async function getRevenueStats() {
  await requireSystemAdmin();

  // MRR (Monthly Recurring Revenue) - approximation from last 30 days payments
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const mrrResult = await prisma.systemPayment.aggregate({
    where: {
      status: "PAID",
      paidAt: { gte: thirtyDaysAgo },
    },
    _sum: { amount: true },
  });

  const totalRevenue = await prisma.systemPayment.aggregate({
    where: { status: "PAID" },
    _sum: { amount: true },
  });

  // Conversion Rate: (Active / (Active + Trial)) * 100
  const activeCount = await prisma.subscription.count({ where: { status: "ACTIVE" } });
  const trialCount = await prisma.subscription.count({ where: { status: "TRIAL" } });
  const totalRelevant = activeCount + trialCount;
  const conversionRate = totalRelevant > 0 ? (activeCount / totalRelevant) * 100 : 0;

  const recentPayments = await prisma.systemPayment.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      subscription: {
        include: {
          tenant: true
        }
      }
    }
  });

  return {
    mrr: (mrrResult._sum.amount || 0).toString(),
    totalRevenue: (totalRevenue._sum.amount || 0).toString(),
    conversionRate,
    recentPayments: recentPayments.map(p => ({
      ...p,
      amount: p.amount.toString()
    })),
  };
}

export async function getAdminStats() {
  const user = await requireSystemAdmin();
  if (!user) redirect("/?error=unauthorized_saas_admin");

  const [totalTenants, totalUsers, activeSubscriptions, trialSubscriptions] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
  ]);

  const recentTenants = await prisma.tenant.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        take: 1,
        orderBy: { createdAt: "asc" } // Get the first user (creator)
      },
      subscription: true
    }
  });

  return {
    totalTenants,
    totalUsers,
    activeSubscriptions,
    trialSubscriptions,
    recentTenants
  };
}
