"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getProjectEstimatedCost } from "@/lib/data";
import { projects as seedProjects, users as seedUsers } from "@/lib/data";
import { getSupabaseBrowserClient, isSupabaseConfigured, mapProfileRowToUser } from "@/lib/supabase/client";
import { ChatMessage, Invoice, PaymentEntry, Project, PurchaseRequest, Task, User } from "@/lib/types";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  at: string;
};

type CreateProjectInput = {
  title: string;
};

type SendMessageInput = {
  body: string;
  emailedTo: string[];
  cc: string[];
  attachments: Array<{
    name: string;
    type: "PDF" | "DOCX" | "Image";
    size: string;
    mimeType?: string;
    dataUrl?: string;
  }>;
};

type AddTaskInput = {
  title: string;
  ownerId: string;
  dueDate: string;
  estimatedCost: number;
};

type AddPurchaseRequestInput = {
  requestNumber: string;
  amount: number;
};

type AddInvoiceInput = {
  prId: string;
  againstType: "PR" | "Advance";
  againstReference?: string;
  invoiceNumber: string;
  invoiceDate: string;
  vendorName: string;
  narration: string;
  amount: number;
  attachments: Array<{
    name: string;
    type: "PDF" | "DOCX" | "Image";
    size: string;
  }>;
};

type AddPaymentInput = {
  prId: string;
  invoiceId?: string;
  advanceMode?: "New" | "Existing";
  advanceReference?: string;
  paidOn: string;
  amount: number;
  reference: string;
  kind: "Advance" | "Payment";
};

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: User["role"];
};

type UpdateUserInput = {
  userId: string;
  name: string;
  email: string;
  password?: string;
  role: User["role"];
};

type BootstrapAdminInput = {
  name: string;
  email: string;
  password: string;
};

type ActionResult = {
  ok: boolean;
  message: string;
};

type InboundEmailReply = {
  externalId: string;
  projectId: string;
  authorName: string;
  authorEmail: string;
  body: string;
  sentAt: string;
  subject: string;
  attachments?: Array<{
    name: string;
    type: "PDF" | "DOCX" | "Image";
    size: string;
    mimeType?: string;
    dataUrl?: string;
  }>;
};

type BackendMode = "local" | "supabase";
type SetupStatus = "checking" | "needs-bootstrap" | "ready";

type AppStateValue = {
  users: User[];
  projects: Project[];
  currentUser: User;
  isAuthenticated: boolean;
  notifications: NotificationItem[];
  hydrated: boolean;
  backendMode: BackendMode;
  setupStatus: SetupStatus;
  signIn: (email: string, password: string) => Promise<ActionResult>;
  signOut: () => Promise<void>;
  bootstrapAdmin: (input: BootstrapAdminInput) => Promise<ActionResult>;
  createUser: (input: CreateUserInput) => Promise<void>;
  updateUser: (input: UpdateUserInput) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, input: SendMessageInput) => Promise<void>;
  syncInboundReplies: (projectId: string) => Promise<void>;
  simulateInboundReply: (projectId: string, body: string) => void;
  addTask: (projectId: string, input: AddTaskInput) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  updateTaskStatus: (projectId: string, taskId: string, status: Task["status"]) => Promise<void>;
  addPurchaseRequest: (projectId: string, input: AddPurchaseRequestInput) => Promise<ActionResult>;
  addInvoice: (projectId: string, input: AddInvoiceInput) => Promise<ActionResult>;
  deleteInvoice: (projectId: string, invoiceId: string) => Promise<void>;
  addPayment: (projectId: string, input: AddPaymentInput) => Promise<ActionResult>;
  deletePayment: (projectId: string, paymentId: string) => Promise<void>;
  markCompleted: (projectId: string) => { ok: boolean; message: string };
  dismissNotification: (notificationId: string) => void;
};

const storageKey = "school-project-tracker-state-v1";
const supabaseEnabled = isSupabaseConfigured();

const AppStateContext = createContext<AppStateValue | null>(null);

function dedupeProjectMessages(project: Project) {
  const seen = new Set<string>();
  const messages = project.messages.filter((message) => {
    const fingerprint = message.externalId
      ? `external:${message.externalId}`
      : `local:${message.id}:${message.sentAt}:${message.direction}:${message.body}`;

    if (seen.has(fingerprint)) {
      return false;
    }

    seen.add(fingerprint);
    return true;
  });

  return messages.length === project.messages.length
    ? project
    : {
        ...project,
        messages
      };
}

function normalizeUsers(users: User[]) {
  return users.map((user) => ({
    ...user,
    active: user.active ?? true
  }));
}

function normalizeProjectsForAssignments(projects: Project[], users: User[]) {
  const activeUsers = users.filter((user) => user.active !== false);
  const fallbackProjectManager = activeUsers.find((user) => user.role === "Project Manager");

  if (!fallbackProjectManager) {
    return projects.map(dedupeProjectMessages);
  }

  return projects.map((project) => {
    const normalizedProject = dedupeProjectMessages(project);
    const assignedManager = users.find((user) => user.id === project.projectManagerId);

    if (assignedManager?.role !== "Admin") {
      return normalizedProject;
    }

    return {
      ...normalizedProject,
      projectManagerId: fallbackProjectManager.id,
      memberIds: Array.from(
        new Set([
          ...normalizedProject.memberIds,
          fallbackProjectManager.id,
          ...activeUsers.filter((user) => user.role === "Admin").map((user) => user.id)
        ])
      )
    };
  });
}

function getPurchaseRequestById(project: Project, prId: string) {
  return project.purchaseRequests.find((request) => request.id === prId);
}

function getInvoicesForPurchaseRequest(project: Project, prId: string) {
  return project.invoices.filter((invoice) => invoice.prId === prId);
}

function getTotalInvoiceAmount(project: Project, prId: string) {
  return getInvoicesForPurchaseRequest(project, prId).reduce((sum, invoice) => sum + invoice.amount, 0);
}

function getTotalAdvanceAmount(request: PurchaseRequest) {
  return (request.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
}

function getTotalInvoicePaymentAmount(project: Project, prId: string) {
  return getInvoicesForPurchaseRequest(project, prId).reduce(
    (sum, invoice) => sum + invoice.payments.reduce((paid, payment) => paid + payment.amount, 0),
    0
  );
}

function buildAdvanceReference(vendorName: string) {
  return `ADV | ${vendorName || "Vendor Pending"}`;
}

function buildIndexedAdvanceReference(vendorName: string, index: number) {
  const normalizedVendor = vendorName || "Vendor Pending";
  return index <= 1 ? buildAdvanceReference(normalizedVendor) : `ADV-${index} | ${normalizedVendor}`;
}

function buildInvoiceReference(invoiceNumber: string, vendorName: string) {
  return `${invoiceNumber || "Invoice"} | ${vendorName || "Vendor Pending"}`;
}

function getAdvanceReferences(request: PurchaseRequest) {
  return Array.from(
    new Set((request.payments ?? []).filter((payment) => payment.kind === "Advance").map((payment) => payment.reference))
  );
}

function getNextAdvanceReference(request: PurchaseRequest) {
  return buildIndexedAdvanceReference(request.vendor, getAdvanceReferences(request).length + 1);
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => normalizeUsers(seedUsers));
  const [projects, setProjects] = useState<Project[]>(() => normalizeProjectsForAssignments(seedProjects, seedUsers));
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>(supabaseEnabled ? "checking" : "ready");

  const backendMode: BackendMode = supabaseEnabled ? "supabase" : "local";

  const currentUser = useMemo(
    () =>
      users.find((user) => user.id === currentUserId) ??
      users.find((user) => user.active !== false) ??
      normalizeUsers(seedUsers)[0],
    [currentUserId, users]
  );

  const isAuthenticated = Boolean(
    currentUserId && users.some((user) => user.id === currentUserId && user.active !== false)
  );

  const pushNotification = useCallback((title: string, body: string) => {
    setNotifications((items) => [
      {
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        body,
        at: new Date().toISOString()
      },
      ...items
    ]);
  }, []);

  const refreshSetupStatus = useCallback(async () => {
    if (!supabaseEnabled) {
      setSetupStatus("ready");
      return;
    }

    try {
      const response = await fetch("/api/setup/status");
      const payload = (await response.json()) as {
        configured?: boolean;
        needsBootstrap?: boolean;
      };

      if (!payload.configured) {
        setSetupStatus("needs-bootstrap");
        return;
      }

      setSetupStatus(payload.needsBootstrap ? "needs-bootstrap" : "ready");
    } catch {
      setSetupStatus("needs-bootstrap");
    }
  }, []);

  const refreshSupabaseData = useCallback(
    async (authUserId?: string | null) => {
      if (!supabaseEnabled) {
        return;
      }

      const client = getSupabaseBrowserClient();
      const resolvedUserId = authUserId ?? (await client.auth.getUser()).data.user?.id ?? null;

      if (!resolvedUserId) {
        setUsers([]);
        setProjects([]);
        setCurrentUserId(null);
        return;
      }

      const profilesTable = client.from("app_profiles" as never) as any;
      const projectsTable = client.from("app_projects" as never) as any;
      const [{ data: profileRows, error: profileError }, { data: projectRows, error: projectError }] =
        await Promise.all([
          profilesTable.select("id, email, name, role, active").order("created_at", { ascending: true }),
          projectsTable.select("id, payload").order("updated_at", { ascending: false })
        ]);

      if (profileError) {
        throw profileError;
      }

      if (projectError) {
        throw projectError;
      }

      const safeProfileRows = (profileRows ?? []) as Array<{
        id: string;
        email: string;
        name: string;
        role: User["role"];
        active: boolean;
      }>;
      const safeProjectRows = (projectRows ?? []) as Array<{ payload: Project }>;
      const nextUsers = normalizeUsers(safeProfileRows.map(mapProfileRowToUser));
      const nextProjects = normalizeProjectsForAssignments(
        safeProjectRows.map((row) => row.payload),
        nextUsers
      );
      const profile = nextUsers.find((user) => user.id === resolvedUserId);

      if (!profile || profile.active === false) {
        await client.auth.signOut();
        setUsers(nextUsers);
        setProjects(nextProjects);
        setCurrentUserId(null);
        pushNotification("Login blocked", "This account is inactive. Please contact the Admin.");
        return;
      }

      setUsers(nextUsers);
      setProjects(nextProjects);
      setCurrentUserId(resolvedUserId);
    },
    [pushNotification]
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      const stored = window.localStorage.getItem(storageKey);

      if (stored) {
        const parsed = JSON.parse(stored) as {
          users?: User[];
          projects?: Project[];
          currentUserId?: string | null;
          notifications?: NotificationItem[];
        };

        const normalizedUsers = normalizeUsers(parsed.users?.length ? parsed.users : seedUsers);
        setUsers(normalizedUsers);
        setProjects(
          normalizeProjectsForAssignments(parsed.projects?.length ? parsed.projects : seedProjects, normalizedUsers)
        );
        setCurrentUserId(parsed.currentUserId ?? null);
        setNotifications(parsed.notifications ?? []);
      }

      setHydrated(true);
      return;
    }

    let cancelled = false;
    const client = getSupabaseBrowserClient();

    async function initialize() {
      try {
        await refreshSetupStatus();
        const {
          data: { user }
        } = await client.auth.getUser();

        if (!cancelled) {
          if (user?.id) {
            await refreshSupabaseData(user.id);
          } else {
            setUsers([]);
            setProjects([]);
            setCurrentUserId(null);
          }
        }
      } catch {
        if (!cancelled) {
          setUsers([]);
          setProjects([]);
          setCurrentUserId(null);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    void initialize();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        try {
          if (session?.user.id) {
            await refreshSupabaseData(session.user.id);
          } else {
            setUsers([]);
            setProjects([]);
            setCurrentUserId(null);
          }
        } finally {
          setHydrated(true);
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refreshSetupStatus, refreshSupabaseData]);

  useEffect(() => {
    if (!hydrated || supabaseEnabled) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ users, projects, currentUserId, notifications })
    );
  }, [currentUserId, hydrated, notifications, projects, users]);

  const getAccessToken = useCallback(async () => {
    if (!supabaseEnabled) {
      return null;
    }

    const client = getSupabaseBrowserClient();
    const {
      data: { session }
    } = await client.auth.getSession();

    return session?.access_token ?? null;
  }, []);

  const persistProject = useCallback(
    async (project: Project) => {
      if (!supabaseEnabled) {
        return;
      }

      const client = getSupabaseBrowserClient();
      const projectsTable = client.from("app_projects" as never) as any;
      const { error } = await projectsTable.upsert({
        id: project.id,
        payload: project
      });

      if (error) {
        pushNotification("Sync failed", "Project changes could not be saved to Supabase.");
        throw error;
      }
    },
    [pushNotification]
  );

  const removeProjectFromBackend = useCallback(
    async (projectId: string) => {
      if (!supabaseEnabled) {
        return;
      }

      const client = getSupabaseBrowserClient();
      const projectsTable = client.from("app_projects" as never) as any;
      const { error } = await projectsTable.delete().eq("id", projectId);

      if (error) {
        pushNotification("Delete failed", "Project could not be removed from Supabase.");
        throw error;
      }
    },
    [pushNotification]
  );

  function dismissNotification(notificationId: string) {
    setNotifications((items) => items.filter((item) => item.id !== notificationId));
  }

  function addAudit(project: Project, message: string) {
    return {
      ...project,
      auditTrail: [
        {
          id: `au-${Date.now()}`,
          actorId: currentUser.id,
          message,
          at: new Date().toISOString()
        },
        ...project.auditTrail
      ]
    };
  }

  function applyProjectUpdate(projectId: string, updater: (project: Project) => Project) {
    let updatedProject: Project | null = null;

    setProjects((items) =>
      items.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        updatedProject = updater(project);
        return updatedProject;
      })
    );

    return updatedProject;
  }

  const value: AppStateValue = {
    users,
    projects,
    currentUser,
    isAuthenticated,
    notifications,
    hydrated,
    backendMode,
    setupStatus,
    signIn: async (email, password) => {
      if (!supabaseEnabled) {
        const normalizedEmail = email.trim().toLowerCase();
        const targetUser = users.find(
          (user) =>
            user.active !== false &&
            user.email.toLowerCase() === normalizedEmail &&
            user.password === password
        );

        if (!targetUser) {
          return {
            ok: false,
            message: "Invalid email or password."
          };
        }

        setCurrentUserId(targetUser.id);
        return {
          ok: true,
          message: `Welcome back, ${targetUser.name}.`
        };
      }

      try {
        const client = getSupabaseBrowserClient();
        const normalizedEmail = email.trim().toLowerCase();
        const { error } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });

        if (error) {
          return {
            ok: false,
            message: "Invalid email or password."
          };
        }

        await refreshSupabaseData();
        return {
          ok: true,
          message: "Signed in successfully."
        };
      } catch {
        return {
          ok: false,
          message: "Login is not available right now."
        };
      }
    },
    signOut: async () => {
      if (!supabaseEnabled) {
        setCurrentUserId(null);
        return;
      }

      const client = getSupabaseBrowserClient();
      await client.auth.signOut();
      setCurrentUserId(null);
      setUsers([]);
      setProjects([]);
    },
    bootstrapAdmin: async (input) => {
      if (!supabaseEnabled) {
        return {
          ok: false,
          message: "Supabase is not configured yet."
        };
      }

      try {
        const response = await fetch("/api/setup/bootstrap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        });
        const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };

        if (!response.ok || !payload.ok) {
          return {
            ok: false,
            message: payload.error ?? "First admin could not be created."
          };
        }

        await refreshSetupStatus();
        return {
          ok: true,
          message: "First admin created. Please sign in with those credentials."
        };
      } catch {
        return {
          ok: false,
          message: "First admin could not be created right now."
        };
      }
    },
    createUser: async (input) => {
      if (currentUser.role !== "Admin") {
        pushNotification("Permission denied", "Only Admins can create users.");
        return;
      }

      if (!input.name.trim() || !input.email.trim() || !input.password.trim()) {
        pushNotification("Missing fields", "Name, email, and password are required.");
        return;
      }

      if (!supabaseEnabled) {
        const nextUser: User = {
          id: `u-${Date.now()}`,
          name: input.name,
          email: input.email,
          password: input.password,
          role: input.role,
          active: true
        };

        setUsers((items) => [...items, nextUser]);
        pushNotification("User created", `${input.name} was added as ${input.role}.`);
        return;
      }

      try {
        const token = await getAccessToken();
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(input)
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };

        if (!response.ok || !payload.ok) {
          pushNotification("User not created", payload.error ?? "The new user could not be saved.");
          return;
        }

        await refreshSupabaseData(currentUserId);
        pushNotification("User created", `${input.name} was added as ${input.role}.`);
      } catch {
        pushNotification("User not created", "The new user could not be saved.");
      }
    },
    updateUser: async (input) => {
      if (currentUser.role !== "Admin") {
        pushNotification("Permission denied", "Only Admins can update users.");
        return;
      }

      if (!input.name.trim() || !input.email.trim()) {
        pushNotification("Missing fields", "Name and email are required.");
        return;
      }

      const targetUser = users.find((user) => user.id === input.userId);
      if (!targetUser) {
        pushNotification("User not found", "The selected user could not be updated.");
        return;
      }

      const adminCount = users.filter((user) => user.role === "Admin" && user.active !== false).length;
      if (targetUser.role === "Admin" && input.role !== "Admin" && adminCount === 1) {
        pushNotification("Update blocked", "Keep at least one Admin account in the system.");
        return;
      }

      if (!supabaseEnabled) {
        setUsers((items) =>
          items.map((user) =>
            user.id === input.userId
              ? {
                  ...user,
                  name: input.name,
                  email: input.email,
                  password: input.password?.trim() ? input.password : user.password,
                  role: input.role,
                  active: user.active ?? true
                }
              : user
          )
        );
        pushNotification("User updated", `${input.name}'s account details were saved.`);
        return;
      }

      try {
        const token = await getAccessToken();
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(input)
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };

        if (!response.ok || !payload.ok) {
          pushNotification("User update failed", payload.error ?? "User details could not be saved.");
          return;
        }

        await refreshSupabaseData(currentUserId);
        pushNotification("User updated", `${input.name}'s account details were saved.`);
      } catch {
        pushNotification("User update failed", "User details could not be saved.");
      }
    },
    deleteUser: async (userId) => {
      if (currentUser.role !== "Admin") {
        pushNotification("Permission denied", "Only Admins can delete users.");
        return;
      }

      const targetUser = users.find((user) => user.id === userId);
      if (!targetUser) {
        pushNotification("User not found", "The selected user could not be deleted.");
        return;
      }

      if (targetUser.id === currentUser.id) {
        pushNotification("Delete blocked", "You cannot delete the account you are currently using.");
        return;
      }

      const adminCount = users.filter((user) => user.role === "Admin" && user.active !== false).length;
      if (targetUser.role === "Admin" && adminCount === 1) {
        pushNotification("Delete blocked", "Keep at least one Admin account in the system.");
        return;
      }

      if (!supabaseEnabled) {
        setUsers((items) =>
          items.map((user) =>
            user.id === userId
              ? {
                  ...user,
                  active: false
                }
              : user
          )
        );
        pushNotification("User deleted", `${targetUser.name} was removed from active users.`);
        return;
      }

      try {
        const token = await getAccessToken();
        const response = await fetch("/api/admin/users", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ userId })
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };

        if (!response.ok || !payload.ok) {
          pushNotification("Delete blocked", payload.error ?? "The user could not be deleted.");
          return;
        }

        await refreshSupabaseData(currentUserId);
        pushNotification("User deleted", `${targetUser.name} was removed from active users.`);
      } catch {
        pushNotification("Delete blocked", "The user could not be deleted.");
      }
    },
    createProject: async (input) => {
      const activeUsers = users.filter((user) => user.active !== false);
      const fallbackProjectManagerId =
        currentUser.role === "Project Manager"
          ? currentUser.id
          : activeUsers.find((user) => user.role === "Project Manager")?.id ??
            activeUsers.find((user) => user.role === "Admin")?.id ??
            currentUser.id;
      const nextProject: Project = {
        id: `p-${Date.now()}`,
        title: input.title,
        code: `SCH-${Math.floor(10000 + Math.random() * 90000)}`,
        vendor: "To be assigned",
        department: "General",
        createdOn: new Date().toISOString().slice(0, 10),
        startDate: new Date().toISOString().slice(0, 10),
        targetDate: new Date().toISOString().slice(0, 10),
        status: "WIP",
        projectManagerId: fallbackProjectManagerId,
        memberIds: Array.from(
          new Set([
            currentUser.id,
            fallbackProjectManagerId,
            ...activeUsers.filter((user) => user.role === "Admin").map((user) => user.id)
          ])
        ),
        estimatedCost: 0,
        summary: "Tasks and cost planning will be added after project creation.",
        tasks: [],
        messages: [],
        purchaseRequests: [],
        invoices: [],
        auditTrail: [
          {
            id: `au-${Date.now()}`,
            actorId: currentUser.id,
            message: "Project created",
            at: new Date().toISOString()
          }
        ]
      };

      setProjects((items) => [nextProject, ...items]);

      try {
        await persistProject(nextProject);
        pushNotification("Project created", `${input.title} is now visible on the dashboard.`);
      } catch {
        if (supabaseEnabled) {
          await refreshSupabaseData(currentUserId);
        }
      }
    },
    deleteProject: async (projectId) => {
      if (currentUser.role !== "Admin") {
        pushNotification("Permission denied", "Only Admins can delete projects.");
        return;
      }

      const targetProject = projects.find((project) => project.id === projectId);
      if (!targetProject) {
        pushNotification("Project not found", "The selected project could not be deleted.");
        return;
      }

      setProjects((items) => items.filter((project) => project.id !== projectId));

      try {
        await removeProjectFromBackend(projectId);
        pushNotification("Project deleted", `${targetProject.title} was removed from the dashboard.`);
      } catch {
        if (supabaseEnabled) {
          await refreshSupabaseData(currentUserId);
        }
      }
    },
    sendMessage: async (projectId, input) => {
      const targetProject = projects.find((project) => project.id === projectId);
      if (!targetProject) {
        pushNotification("Project not found", "The chat message could not be sent.");
        return;
      }

      if (input.emailedTo.map((email) => email.trim()).filter(Boolean).length === 0) {
        pushNotification("To required", "Select at least one recipient in To before sending the chat.");
        return;
      }
      const attachments = input.attachments.map((attachment, index) => ({
        id: `a-${Date.now()}-${index}`,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        uploadedBy: currentUser.id,
        mimeType: attachment.mimeType,
        dataUrl: attachment.dataUrl
      }));
      const recipientEmails = Array.from(
        new Set([...input.emailedTo, ...input.cc].map((email) => email.trim()).filter(Boolean))
      );
      const normalizedRecipientEmails = recipientEmails.map((email) => email.toLowerCase());
      const recipientUserIds = users
        .filter((user) => normalizedRecipientEmails.includes(user.email.toLowerCase()) && user.active !== false)
        .map((user) => user.id);
      const nextMessage: ChatMessage = {
        id: `m-${Date.now()}`,
        authorId: currentUser.id,
        body: input.body,
        sentAt: new Date().toISOString(),
        emailedTo: recipientEmails.filter(
          (email) => !input.cc.some((ccEmail) => ccEmail.trim().toLowerCase() === email.toLowerCase())
        ),
        cc: recipientEmails.filter((email) =>
          input.cc.some((ccEmail) => ccEmail.trim().toLowerCase() === email.toLowerCase())
        ),
        direction: "App",
        attachments
      };
      const historyForEmail = [...targetProject.messages]
        .slice()
        .reverse()
        .map((message) => ({
          authorName: users.find((user) => user.id === message.authorId)?.name ?? "External sender",
          body: message.body,
          sentAt: message.sentAt,
          direction: message.direction
        }));

      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            memberIds: Array.from(new Set([...project.memberIds, ...recipientUserIds])),
            messages: [nextMessage, ...project.messages]
          },
          "New project message sent and synced to email recipients"
        )
      );

      pushNotification("Message sent", "Project chat updated and queued for email sync.");

      if (updatedProject) {
        try {
          await persistProject(updatedProject);
        } catch {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        }
      }

      try {
        const response = await fetch("/api/email/outbound", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            projectId,
            projectTitle: targetProject.title,
            projectCode: targetProject.code,
            authorName: currentUser.name,
            authorEmail: currentUser.email,
            body: input.body,
            attachments: attachments.map((attachment) => ({
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
              mimeType: attachment.mimeType,
              dataUrl: attachment.dataUrl
            })),
            history: historyForEmail,
            to: nextMessage.emailedTo,
            cc: nextMessage.cc
          })
        });

        if (!response.ok) {
          throw new Error("Email request failed");
        }

        pushNotification("Email sent", "Chat message was delivered through Gmail.");
      } catch {
        pushNotification("Email failed", "Chat was saved in the app, but Gmail sending did not complete.");
      }
    },
    syncInboundReplies: async (projectId) => {
      try {
        const response = await fetch(`/api/email/inbound?projectId=${encodeURIComponent(projectId)}`);
        if (!response.ok) {
          throw new Error("Inbound email request failed");
        }

        const payload = (await response.json()) as {
          ok: boolean;
          replies: InboundEmailReply[];
        };
        let syncedReplies: InboundEmailReply[] = [];
        let updatedProject: Project | null = null;

        setProjects((items) =>
          items.map((project) => {
            if (project.id !== projectId) {
              return project;
            }

            const existingExternalIds = new Set(
              project.messages
                .map((message) => message.externalId)
                .filter((value): value is string => Boolean(value))
            );
            const nextReplies = payload.replies
              .filter((reply) => !existingExternalIds.has(reply.externalId))
              .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime());

            if (nextReplies.length === 0) {
              return project;
            }

            syncedReplies = nextReplies;
            updatedProject = addAudit(
              {
                ...project,
                messages: [
                  ...nextReplies.map(
                    (reply) =>
                      ({
                        id: `m-${reply.externalId}`,
                        externalId: reply.externalId,
                        authorId: "external-email",
                        authorName: reply.authorName,
                        authorEmail: reply.authorEmail,
                        body: reply.body,
                        sentAt: reply.sentAt,
                        emailedTo: [],
                        cc: [],
                        direction: "Email",
                        attachments: (reply.attachments ?? []).map((attachment, index) => ({
                          id: `ea-${reply.externalId}-${index}`,
                          name: attachment.name,
                          type: attachment.type,
                          size: attachment.size,
                          uploadedBy: "external-email",
                          mimeType: attachment.mimeType,
                          dataUrl: attachment.dataUrl
                        }))
                      }) satisfies ChatMessage
                  ),
                  ...project.messages
                ]
              },
              nextReplies.length === 1
                ? "Inbound email reply synced into project conversation"
                : `${nextReplies.length} inbound email replies synced into project conversation`
            );

            return updatedProject;
          })
        );

        if (syncedReplies.length === 0) {
          return;
        }

        if (updatedProject) {
          try {
            await persistProject(updatedProject);
          } catch {
            if (supabaseEnabled) {
              await refreshSupabaseData(currentUserId);
            }
          }
        }

        pushNotification(
          "Email reply synced",
          syncedReplies.length === 1
            ? `${syncedReplies[0].authorName} replied from email and it was added to the project chat.`
            : `${syncedReplies.length} email replies were added to the project chat.`
        );
      } catch {
        pushNotification("Inbound sync failed", "Gmail replies could not be checked right now.");
      }
    },
    simulateInboundReply: (projectId, body) => {
      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            messages: [
              {
                id: `m-${Date.now()}`,
                authorId: project.memberIds.includes("u4") ? "u4" : currentUser.id,
                authorName: "Sample email reply",
                authorEmail: "sample.reply@example.com",
                body,
                sentAt: new Date().toISOString(),
                emailedTo: [],
                cc: [],
                direction: "Email",
                attachments: []
              },
              ...project.messages
            ]
          },
          "Inbound email reply parsed into project conversation"
        )
      );

      if (updatedProject) {
        void persistProject(updatedProject);
      }

      pushNotification("Inbound email synced", "A reply from email has been posted back to the chat thread.");
    },
    addTask: async (projectId, input) => {
      const task: Task = {
        id: `t-${Date.now()}`,
        title: input.title,
        ownerId: input.ownerId,
        dueDate: input.dueDate,
        estimatedCost: input.estimatedCost,
        status: "Open"
      };

      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            tasks: [task, ...project.tasks],
            estimatedCost: [task, ...project.tasks].reduce((sum, entry) => sum + entry.estimatedCost, 0)
          },
          "Task added to project plan"
        )
      );

      if (updatedProject) {
        try {
          await persistProject(updatedProject);
          pushNotification("Task added", `${input.title} has been added to the plan.`);
        } catch {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        }
      }
    },
    deleteTask: async (projectId, taskId) => {
      const targetProject = projects.find((project) => project.id === projectId);
      if (!targetProject) {
        pushNotification("Project not found", "The task could not be deleted.");
        return;
      }

      if (!(currentUser.role === "Admin" || targetProject.projectManagerId === currentUser.id)) {
        pushNotification("Permission denied", "Only the assigned Project Manager can delete tasks.");
        return;
      }

      const targetTask = targetProject.tasks.find((task) => task.id === taskId);
      if (!targetTask) {
        pushNotification("Task not found", "The selected task could not be deleted.");
        return;
      }

      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            tasks: project.tasks.filter((task) => task.id !== taskId),
            estimatedCost: project.tasks
              .filter((task) => task.id !== taskId)
              .reduce((sum, task) => sum + task.estimatedCost, 0)
          },
          "Task deleted from project plan"
        )
      );

      if (updatedProject) {
        try {
          await persistProject(updatedProject);
          pushNotification("Task deleted", `${targetTask.title} was removed from the plan.`);
        } catch {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        }
      }
    },
    updateTaskStatus: async (projectId, taskId, status) => {
      const targetProject = projects.find((project) => project.id === projectId);
      if (!targetProject) {
        pushNotification("Project not found", "The task could not be updated.");
        return;
      }

      if (!(currentUser.role === "Admin" || targetProject.projectManagerId === currentUser.id)) {
        pushNotification("Permission denied", "Only the assigned Project Manager can update task status.");
        return;
      }

      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            tasks: project.tasks.map((task) => (task.id === taskId ? { ...task, status } : task))
          },
          `Task status changed to ${status}`
        )
      );

      if (updatedProject) {
        try {
          await persistProject(updatedProject);
          pushNotification("Task updated", `Task status changed to ${status}.`);
        } catch {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        }
      }
    },
    addPurchaseRequest: async (projectId, input) => {
      if (!(currentUser.role === "Admin" || currentUser.role === "Project Manager")) {
        const message = "Only Admins and Project Managers can add purchase requests.";
        pushNotification("Permission denied", message);
        return { ok: false, message };
      }

      if (!input.requestNumber.trim() || !input.amount || input.amount <= 0) {
        const message = "Enter PR Number and a valid amount.";
        pushNotification("Missing fields", message);
        return { ok: false, message };
      }

      const targetProject = projects.find((project) => project.id === projectId);
      if (!targetProject) {
        const message = "The selected project could not be updated.";
        pushNotification("Project not found", message);
        return { ok: false, message };
      }

      const projectCost = getProjectEstimatedCost(targetProject);
      const currentPrTotal = targetProject.purchaseRequests.reduce((sum, request) => sum + request.amount, 0);
      if (currentPrTotal + input.amount > projectCost) {
        const message = `PR total cannot exceed the project cost of INR ${projectCost.toLocaleString("en-IN")}.`;
        pushNotification("PR limit exceeded", message);
        return { ok: false, message };
      }

      const normalizedRequestNumber = input.requestNumber.trim().toLowerCase();
      const existingRequest = targetProject.purchaseRequests.find(
        (request) => request.requestNumber.trim().toLowerCase() === normalizedRequestNumber
      );

      const request: PurchaseRequest = {
        id: `pr-${Date.now()}`,
        requestNumber: input.requestNumber,
        vendor: "To be added from invoice",
        description: "",
        amount: input.amount,
        raisedOn: new Date().toISOString().slice(0, 10),
        status: "Pending Approval",
        payments: []
      };

      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            purchaseRequests: existingRequest
              ? project.purchaseRequests.map((item) =>
                  item.id === existingRequest.id
                    ? {
                        ...item,
                        amount: item.amount + input.amount
                      }
                    : item
                )
              : [request, ...project.purchaseRequests]
          },
          existingRequest ? "Purchase request amount updated" : "Purchase request raised"
        )
      );

      const message = existingRequest
        ? `${existingRequest.requestNumber} was updated by INR ${input.amount.toLocaleString("en-IN")}.`
        : `${request.requestNumber} was added to the project.`;

      if (updatedProject) {
        try {
          await persistProject(updatedProject);
          pushNotification("PR logged", message);
          return { ok: true, message };
        } catch {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        }
      }

      return { ok: false, message: "Purchase request could not be saved." };
    },
    addInvoice: async (projectId, input) => {
      if (!(currentUser.role === "Admin" || currentUser.role === "Project Manager")) {
        const message = "Only Admins and Project Managers can add invoices.";
        pushNotification("Permission denied", message);
        return { ok: false, message };
      }

      if (
        !input.prId ||
        !input.invoiceNumber.trim() ||
        !input.invoiceDate ||
        !input.vendorName.trim() ||
        !input.narration.trim() ||
        !input.amount ||
        input.amount <= 0
      ) {
        const message = "Fill PR, Invoice Number, Invoice Date, Vendor, Narration, and a valid amount.";
        pushNotification("Missing fields", message);
        return { ok: false, message };
      }

      const targetProject = projects.find((project) => project.id === projectId);
      if (!targetProject) {
        const message = "The selected project could not be updated.";
        pushNotification("Project not found", message);
        return { ok: false, message };
      }

      const targetRequest = getPurchaseRequestById(targetProject, input.prId);
      if (!targetRequest) {
        const message = "Select a valid purchase request before adding an invoice.";
        pushNotification("PR not found", message);
        return { ok: false, message };
      }

      if (input.againstType === "Advance" && !input.againstReference) {
        const message = "Select an advance reference before creating an invoice against advance payment.";
        pushNotification("Advance reference required", message);
        return { ok: false, message };
      }

      const currentInvoiceTotal = getTotalInvoiceAmount(targetProject, input.prId);
      if (currentInvoiceTotal + input.amount > targetRequest.amount) {
        const message = `Total invoices cannot exceed PR ${targetRequest.requestNumber} amount of INR ${targetRequest.amount.toLocaleString("en-IN")}.`;
        pushNotification("Invoice limit exceeded", message);
        return { ok: false, message };
      }

      const invoice: Invoice = {
        id: `i-${Date.now()}`,
        prId: input.prId,
        againstType: input.againstType,
        againstReference: input.againstType === "Advance" ? input.againstReference : targetRequest.requestNumber,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        vendorName: input.vendorName,
        amount: input.amount,
        narration: input.narration,
        attachments: input.attachments.map((attachment, index) => ({
          id: `ia-${Date.now()}-${index}`,
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          uploadedBy: currentUser.id
        })),
        payments: []
      };

      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            purchaseRequests: project.purchaseRequests.map((request) =>
              request.id === input.prId && request.vendor === "To be added from invoice"
                ? {
                    ...request,
                    vendor: input.vendorName
                  }
                : request
            ),
            invoices: [invoice, ...project.invoices]
          },
          "Invoice logged against project"
        )
      );

      const message =
        input.againstType === "Advance" && input.againstReference
          ? `${input.invoiceNumber} is now tracked against ${input.againstReference}.`
          : `${input.invoiceNumber} is now tracked against ${targetRequest.requestNumber}.`;

      if (updatedProject) {
        try {
          await persistProject(updatedProject);
          pushNotification("Invoice recorded", message);
          return { ok: true, message };
        } catch {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        }
      }

      return { ok: false, message: "Invoice could not be saved." };
    },
    deleteInvoice: async (projectId, invoiceId) => {
      const targetProject = projects.find((project) => project.id === projectId);
      if (!targetProject) {
        pushNotification("Project not found", "The invoice could not be deleted.");
        return;
      }

      if (!(currentUser.role === "Admin" || targetProject.projectManagerId === currentUser.id)) {
        pushNotification("Permission denied", "Only the assigned Project Manager can delete invoices.");
        return;
      }

      const targetInvoice = targetProject.invoices.find((invoice) => invoice.id === invoiceId);
      if (!targetInvoice) {
        pushNotification("Invoice not found", "The selected invoice could not be deleted.");
        return;
      }

      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            invoices: project.invoices.filter((invoice) => invoice.id !== invoiceId)
          },
          "Invoice deleted from project finance"
        )
      );

      if (updatedProject) {
        try {
          await persistProject(updatedProject);
          pushNotification("Invoice deleted", `${targetInvoice.invoiceNumber} was removed from finance.`);
        } catch {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        }
      }
    },
    addPayment: async (projectId, input) => {
      if (!(currentUser.role === "Admin" || currentUser.role === "Project Manager")) {
        const message = "Only Admins and Project Managers can add payments.";
        pushNotification("Permission denied", message);
        return { ok: false, message };
      }

      if (!input.prId || !input.paidOn || !input.amount || input.amount <= 0) {
        const message = "Fill PR, payment date, and a valid amount.";
        pushNotification("Missing fields", message);
        return { ok: false, message };
      }

      const targetProject = projects.find((project) => project.id === projectId);
      if (!targetProject) {
        const message = "The selected project could not be updated.";
        pushNotification("Project not found", message);
        return { ok: false, message };
      }

      const targetRequest = getPurchaseRequestById(targetProject, input.prId);
      if (!targetRequest) {
        const message = "Select a valid purchase request before adding a transaction.";
        pushNotification("PR not found", message);
        return { ok: false, message };
      }

      const currentAdvanceTotal = getTotalAdvanceAmount(targetRequest);
      const currentInvoicePaymentTotal = getTotalInvoicePaymentAmount(targetProject, input.prId);
      const totalPaymentsAgainstPr = currentAdvanceTotal + currentInvoicePaymentTotal;

      if (totalPaymentsAgainstPr + input.amount > targetRequest.amount) {
        const message = `Total advances and payments cannot exceed PR ${targetRequest.requestNumber} amount of INR ${targetRequest.amount.toLocaleString("en-IN")}.`;
        pushNotification("Payment limit exceeded", message);
        return { ok: false, message };
      }

      if (input.kind === "Payment") {
        if (!input.invoiceId) {
          const message = "Select an invoice before recording a payment.";
          pushNotification("Invoice required", message);
          return { ok: false, message };
        }

        const targetInvoice = targetProject.invoices.find((invoice) => invoice.id === input.invoiceId);
        if (!targetInvoice) {
          const message = "Select a valid invoice before adding a payment.";
          pushNotification("Invoice not found", message);
          return { ok: false, message };
        }

        const currentInvoicePaymentAmount = targetInvoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
        if (currentInvoicePaymentAmount + input.amount > targetInvoice.amount) {
          const message = `Payments cannot exceed invoice ${targetInvoice.invoiceNumber} amount of INR ${targetInvoice.amount.toLocaleString("en-IN")}.`;
          pushNotification("Invoice payment exceeded", message);
          return { ok: false, message };
        }
      }

      if (input.kind === "Advance" && input.advanceMode === "Existing" && !input.advanceReference) {
        const message = "Select an existing advance reference or choose new advance payment.";
        pushNotification("Advance reference required", message);
        return { ok: false, message };
      }

      const resolvedAdvanceReference =
        input.kind === "Advance"
          ? input.advanceMode === "Existing" && input.advanceReference
            ? input.advanceReference
            : getNextAdvanceReference(targetRequest)
          : undefined;

      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            purchaseRequests: project.purchaseRequests.map((request) =>
              request.id === input.prId && input.kind === "Advance"
                ? {
                    ...request,
                    payments: [
                      {
                        id: `pay-${Date.now()}`,
                        paidOn: input.paidOn,
                        amount: input.amount,
                        reference: resolvedAdvanceReference ?? buildAdvanceReference(request.vendor),
                        kind: input.kind
                      } satisfies PaymentEntry,
                      ...(request.payments ?? [])
                    ]
                  }
                : request
            ),
            invoices: project.invoices.map((invoice) =>
              invoice.id === input.invoiceId && input.kind === "Payment"
                ? {
                    ...invoice,
                    payments: [
                      {
                        id: `pay-${Date.now()}`,
                        paidOn: input.paidOn,
                        amount: input.amount,
                        reference: buildInvoiceReference(invoice.invoiceNumber, invoice.vendorName),
                        kind: input.kind
                      } satisfies PaymentEntry,
                      ...invoice.payments
                    ]
                  }
                : invoice
            )
          },
          input.kind === "Advance" ? "Advance payment added against PR" : "Payment entry added to invoice ledger"
        )
      );

      const message =
        input.kind === "Advance"
          ? `Advance of INR ${input.amount} was recorded under ${resolvedAdvanceReference}.`
          : `Payment of INR ${input.amount} was recorded against the invoice.`;

      if (updatedProject) {
        try {
          await persistProject(updatedProject);
          pushNotification(input.kind === "Advance" ? "Advance posted" : "Payment posted", message);
          return { ok: true, message };
        } catch {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        }
      }

      return { ok: false, message: "Payment could not be saved." };
    },
    deletePayment: async (projectId, paymentId) => {
      const targetProject = projects.find((project) => project.id === projectId);
      if (!targetProject) {
        pushNotification("Project not found", "The payment could not be deleted.");
        return;
      }

      if (!(currentUser.role === "Admin" || targetProject.projectManagerId === currentUser.id)) {
        pushNotification("Permission denied", "Only the assigned Project Manager can delete payments.");
        return;
      }

      const prWithPayment = targetProject.purchaseRequests.find((request) =>
        (request.payments ?? []).some((payment) => payment.id === paymentId)
      );
      const invoiceWithPayment = targetProject.invoices.find((invoice) =>
        invoice.payments.some((payment) => payment.id === paymentId)
      );

      if (!prWithPayment && !invoiceWithPayment) {
        pushNotification("Payment not found", "The selected payment could not be deleted.");
        return;
      }

      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit(
          {
            ...project,
            purchaseRequests: project.purchaseRequests.map((request) =>
              request.id === prWithPayment?.id
                ? {
                    ...request,
                    payments: (request.payments ?? []).filter((payment) => payment.id !== paymentId)
                  }
                : request
            ),
            invoices: project.invoices.map((invoice) =>
              invoice.id === invoiceWithPayment?.id
                ? {
                    ...invoice,
                    payments: invoice.payments.filter((payment) => payment.id !== paymentId)
                  }
                : invoice
            )
          },
          "Payment deleted from project finance"
        )
      );

      if (updatedProject) {
        try {
          await persistProject(updatedProject);
          pushNotification("Payment deleted", "The selected payment was removed from finance.");
        } catch {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        }
      }
    },
    markCompleted: (projectId) => {
      const target = projects.find((project) => project.id === projectId);

      if (!target) {
        return { ok: false, message: "Project not found." };
      }

      if (target.projectManagerId !== currentUser.id) {
        return { ok: false, message: "Only the assigned Project Manager can change this project status." };
      }

      const nextStatus = target.status === "Completed" ? "WIP" : "Completed";
      const auditMessage =
        nextStatus === "Completed" ? "Project marked as Completed" : "Project moved back to WIP";
      const updatedProject = applyProjectUpdate(projectId, (project) =>
        addAudit({ ...project, status: nextStatus }, auditMessage)
      );

      if (updatedProject) {
        void persistProject(updatedProject).catch(async () => {
          if (supabaseEnabled) {
            await refreshSupabaseData(currentUserId);
          }
        });
      }

      pushNotification(
        nextStatus === "Completed" ? "Project completed" : "Project reopened",
        `${target.title} has been moved to ${nextStatus}.`
      );

      return {
        ok: true,
        message: nextStatus === "Completed" ? "Project marked as Completed." : "Project moved back to WIP."
      };
    },
    dismissNotification
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }

  return context;
}
