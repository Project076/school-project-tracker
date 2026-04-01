"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/app-state";
import { formatCurrency, formatDate, formatDateTime, getBalanceDue, getProjectEstimatedCost } from "@/lib/data";
import { Project, UserRole } from "@/lib/types";

type DashboardProps = {
  filters: {
    q?: string;
    status?: string;
    vendor?: string;
    month?: string;
  };
};

type DashboardTab = "dashboard" | "projects" | "users" | "notifications";
type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export function Dashboard({ filters }: DashboardProps) {
  const {
    backendMode,
    bootstrapAdmin,
    createProject,
    createUser,
    currentUser,
    isAuthenticated,
    deleteUser,
    deleteProject,
    dismissNotification,
    hydrated,
    notifications,
    projects,
    signIn,
    signOut,
    setupStatus,
    updateUser,
    users
  } = useAppState();
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showProjectComposer, setShowProjectComposer] = useState(false);
  const [showUserComposer, setShowUserComposer] = useState(false);
  const [expandedProjectGroups, setExpandedProjectGroups] = useState({
    wip: false,
    completed: false
  });
  const [projectSearch, setProjectSearch] = useState(filters.q ?? "");
  const activeUsers = users.filter((user) => user.active !== false);
  const [projectForm, setProjectForm] = useState({
    title: ""
  });
  const [userForm, setUserForm] = useState<UserFormState>({
    name: "",
    email: "",
    password: "",
    role: "Member"
  });
  const [authForm, setAuthForm] = useState({
    email: "",
    password: ""
  });
  const [authFeedback, setAuthFeedback] = useState("");
  const [bootstrapForm, setBootstrapForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [bootstrapFeedback, setBootstrapFeedback] = useState("");

  useEffect(() => {
    setProjectSearch(filters.q ?? "");
  }, [filters.q]);

  const visibleProjects = useMemo(
    () =>
      isAuthenticated
        ? projects.filter(
            (project) =>
              currentUser.role === "Admin" ||
              project.projectManagerId === currentUser.id ||
              project.memberIds.includes(currentUser.id)
          )
        : [],
    [currentUser.id, currentUser.role, isAuthenticated, projects]
  );

  const vendors = Array.from(new Set(visibleProjects.map((project) => project.vendor)));
  const totalSpend = visibleProjects
    .flatMap((project) => project.invoices)
    .reduce((sum, invoice) => sum + invoice.payments.reduce((paid, entry) => paid + entry.amount, 0), 0);
  const totalBalance = visibleProjects
    .flatMap((project) => project.invoices)
    .reduce((sum, invoice) => sum + getBalanceDue(invoice.amount, invoice.payments), 0);

  const filteredProjects = useMemo(
    () =>
      visibleProjects.filter((project) => {
        const matchesQuery =
          !projectSearch || project.title.toLowerCase().includes(projectSearch.toLowerCase());

        return matchesQuery;
      }),
    [projectSearch, visibleProjects]
  );

  const myProjects = filteredProjects;
  const managedProjects = filteredProjects.filter((project) => project.projectManagerId === currentUser.id);
  const recentProjects = filteredProjects;
  const wipProjectList = filteredProjects.filter((project) => project.status === "WIP");
  const completedProjectList = filteredProjects.filter((project) => project.status === "Completed");
  const completedProjects = filteredProjects.filter((project) => project.status === "Completed").length;
  const wipProjects = filteredProjects.filter((project) => project.status === "WIP").length;
  const totalTasksVisible = filteredProjects.reduce((sum, project) => sum + project.tasks.length, 0);

  const menuTabs: { id: DashboardTab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "projects", label: "Projects" },
    ...(currentUser.role === "Admin" ? [{ id: "users" as const, label: "Users" }] : []),
    { id: "notifications", label: "Notifications" }
  ];

  const projectCountByUser = useMemo(
    () =>
      users.reduce<Record<string, number>>((result, user) => {
        result[user.id] = projects.filter(
          (project) => project.projectManagerId === user.id || project.memberIds.includes(user.id)
        ).length;
        return result;
      }, {}),
    [projects, users]
  );

  function resetUserForm() {
    setEditingUserId(null);
    setShowUserComposer(false);
    setUserForm({ name: "", email: "", password: "", role: "Member" });
  }

  if (!isAuthenticated) {
    return (
      <main className="page-shell">
        <section className="hero" style={{ maxWidth: 560, margin: "40px auto 0" }}>
          <div className="panel stack" style={{ gap: 18 }}>
            <div className="compact-title">
              <p className="eyebrow">School Project Tracker</p>
              <h2>{backendMode === "supabase" && setupStatus === "needs-bootstrap" ? "Create first admin" : "Sign in"}</h2>
            </div>
            <p className="subtle">
              {backendMode === "supabase"
                ? setupStatus === "checking"
                  ? "Checking the shared workspace setup."
                  : setupStatus === "needs-bootstrap"
                    ? "This is the first time the shared workspace is being used. Create the first Admin account, then sign in from any computer or phone."
                    : "Only logged-in users can open the dashboard. Admin can create more users after signing in."
                : "Only logged-in users can open the dashboard. Admin can create more users after signing in."}
            </p>

            {backendMode === "supabase" && setupStatus === "checking" ? (
              <div className="activity-item">
                <p className="subtle">Checking setup...</p>
              </div>
            ) : null}

            {backendMode === "supabase" && setupStatus === "needs-bootstrap" ? (
              <form
                className="stack"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const result = await bootstrapAdmin(bootstrapForm);
                  setBootstrapFeedback(result.message);

                  if (result.ok) {
                    setBootstrapForm({ name: "", email: "", password: "" });
                  }
                }}
              >
                <input
                  placeholder="Admin name"
                  style={inputStyle}
                  value={bootstrapForm.name}
                  onChange={(event) => setBootstrapForm((value) => ({ ...value, name: event.target.value }))}
                />
                <input
                  placeholder="Admin email"
                  style={inputStyle}
                  value={bootstrapForm.email}
                  onChange={(event) => setBootstrapForm((value) => ({ ...value, email: event.target.value }))}
                />
                <input
                  type="password"
                  placeholder="Admin password"
                  style={inputStyle}
                  value={bootstrapForm.password}
                  onChange={(event) => setBootstrapForm((value) => ({ ...value, password: event.target.value }))}
                />
                {bootstrapFeedback ? (
                  <div className={`form-feedback ${bootstrapFeedback.includes("created") ? "success" : "error"}`}>
                    {bootstrapFeedback}
                  </div>
                ) : null}
                <button className="button-primary" type="submit">
                  Create first admin
                </button>
              </form>
            ) : (
              <form
                className="stack"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const result = await signIn(authForm.email, authForm.password);
                  setAuthFeedback(result.message);

                  if (result.ok) {
                    setAuthForm({ email: "", password: "" });
                  }
                }}
              >
                <input
                  placeholder="Email"
                  style={inputStyle}
                  value={authForm.email}
                  onChange={(event) => setAuthForm((value) => ({ ...value, email: event.target.value }))}
                />
                <input
                  type="password"
                  placeholder="Password"
                  style={inputStyle}
                  value={authForm.password}
                  onChange={(event) => setAuthForm((value) => ({ ...value, password: event.target.value }))}
                />
                {authFeedback ? (
                  <div className={`form-feedback ${authFeedback.toLowerCase().includes("success") || authFeedback.toLowerCase().includes("welcome") ? "success" : "error"}`}>
                    {authFeedback}
                  </div>
                ) : null}
                <button className="button-primary" type="submit">
                  Sign in
                </button>
              </form>
            )}

            <div className="activity-item">
              <p className="label">{backendMode === "supabase" ? "Shared workspace" : "Starter access"}</p>
              <p className="subtle">
                {backendMode === "supabase"
                  ? "Users, passwords, projects, and chat are now designed to live in Supabase so the same login works across different devices."
                  : "Use the initial admin account details provided during setup, then create role-based users from the Admin panel."}
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="topbar">
        <div className="topbar-title-group">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setShowMobileMenu((value) => !value)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="compact-title">
            <p className="eyebrow">School Project Tracker</p>
            <h3>{roleTitle(currentUser.role)}</h3>
          </div>
        </div>
        <div className="inline-list">
          <span className="pill">{hydrated ? "Saved locally" : "Loading"}</span>
          <button type="button" className="button-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{roleTitle(currentUser.role)}</p>
            <h1>{heroTitle(currentUser.role)}</h1>
            <div className="hero-chip-row">
              <span className="hero-chip">{wipProjects} WIP</span>
              <span className="hero-chip">{completedProjects} Completed</span>
              <span className="hero-chip">{vendors.length} Vendors</span>
              <span className="hero-chip">{totalTasksVisible} Tasks</span>
            </div>
          </div>
          <div className="hero-side stack">
            <div className="metric dashboard-identity-card">
              <p className="label">Signed in as</p>
              <h3>{currentUser.name}</h3>
              <p className="subtle">{currentUser.role}</p>
              <p className="subtle" style={{ marginTop: 12 }}>{currentUser.email}</p>
            </div>
          </div>
        </div>

        {currentUser.role === "Admin" ? (
          <div className="stats-grid">
            <MetricCard label="Total projects" value={visibleProjects.length} note="Across all teams" />
            <MetricCard label="Users" value={activeUsers.length} note="Active accounts" />
            <MetricCard label="Payments logged" value={formatCurrency(totalSpend)} note="Tracked spend" />
            <MetricCard label="Balance due" value={formatCurrency(totalBalance)} note="Outstanding amount" />
          </div>
        ) : null}

        {currentUser.role === "Project Manager" ? (
          <div className="stats-grid">
            <MetricCard label="Managed projects" value={managedProjects.length} note="Assigned to you" />
            <MetricCard
              label="Open tasks"
              value={managedProjects.reduce(
                (sum, project) => sum + project.tasks.filter((task) => task.status !== "Done").length,
                0
              )}
              note="Pending work items"
            />
            <MetricCard
              label="Project budgets"
              value={formatCurrency(managedProjects.reduce((sum, project) => sum + getProjectEstimatedCost(project), 0))}
              note="Budget under management"
            />
            <MetricCard label="Vendors" value={vendors.length} note="Active vendors" />
          </div>
        ) : null}

        {currentUser.role === "Member" ? (
          <div className="stats-grid">
            <MetricCard label="My projects" value={myProjects.length} note="Projects you can access" />
            <MetricCard
              label="Discussion threads"
              value={myProjects.reduce((sum, project) => sum + project.messages.length, 0)}
              note="Visible conversations"
            />
            <MetricCard
              label="Open tasks"
              value={myProjects.reduce(
                (sum, project) => sum + project.tasks.filter((task) => task.status !== "Done").length,
                0
              )}
              note="Current workload"
            />
            <MetricCard
              label="Vendors"
              value={Array.from(new Set(myProjects.map((project) => project.vendor))).length}
              note="Related vendors"
            />
          </div>
        ) : null}
      </section>

      <section className="split-shell" style={{ marginTop: 24 }}>
        {showMobileMenu ? <button type="button" className="mobile-menu-backdrop" onClick={() => setShowMobileMenu(false)} aria-label="Close menu" /> : null}
        <aside className={`sidebar-panel mobile-drawer ${showMobileMenu ? "open" : ""}`}>
          <div className="section-title" style={{ marginBottom: 18 }}>
            <div>
              <p className="eyebrow">Menu</p>
              <h2>{menuHeading(activeTab)}</h2>
            </div>
          </div>

          <div className="sidebar-menu">
            {menuTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowMobileMenu(false);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="content-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Workspace</p>
              <h2>{menuHeading(activeTab)}</h2>
            </div>
            <span className="pill">{menuTabs.length} sections</span>
          </div>

          {activeTab === "dashboard" ? (
            <div className="stack">
              <div className="stats-grid" style={{ marginTop: 0 }}>
                <MetricCard label="WIP projects" value={wipProjects} note="Projects in progress" />
                <MetricCard label="Completed" value={completedProjects} note="Finished projects" />
                <MetricCard label="Visible tasks" value={totalTasksVisible} note="Across your scope" />
                <MetricCard label="Vendors" value={vendors.length} note="Active project vendors" />
              </div>

              <div className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Dashboard</p>
                    <h3>Overview</h3>
                  </div>
                  <span className="pill">{visibleProjects.length} projects</span>
                </div>

                <div className="project-metrics">
                  <div className="project-metric-tile">
                    <p className="label">Managed projects</p>
                    <p>{managedProjects.length}</p>
                  </div>
                  <div className="project-metric-tile">
                    <p className="label">Discussion threads</p>
                    <p>{myProjects.reduce((sum, project) => sum + project.messages.length, 0)}</p>
                  </div>
                  <div className="project-metric-tile">
                    <p className="label">Payments logged</p>
                    <p>{formatCurrency(totalSpend)}</p>
                  </div>
                  <div className="project-metric-tile">
                    <p className="label">Balance due</p>
                    <p>{formatCurrency(totalBalance)}</p>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Recent projects</p>
                    <h3>Quick view</h3>
                  </div>
                </div>
                <div className="project-list">
                  {recentProjects.slice(0, 3).map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      users={users}
                      canDelete={currentUser.role === "Admin"}
                      onDelete={async () => {
                        if (window.confirm(`Delete project "${project.title}"? This cannot be undone.`)) {
                          await deleteProject(project.id);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "projects" ? (
            <>
              <div className="panel" style={{ marginBottom: 20 }}>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Project controls</p>
                    <h3>Create project</h3>
                  </div>
                </div>
                <div className="stack">
                  <div className="inline-list">
                    <button
                      className={`button-primary ${showProjectComposer ? "button-muted" : ""}`}
                      type="button"
                      onClick={() => setShowProjectComposer((value) => !value)}
                    >
                      {showProjectComposer ? "Hide form" : "Create Project"}
                    </button>
                    <span className="pill">Tasks define project cost</span>
                  </div>

                  {showProjectComposer ? (
                    <form
                      className="compact-create-form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        await createProject({
                          title: projectForm.title
                        });
                        setProjectForm((value) => ({
                          ...value,
                          title: ""
                        }));
                        setShowProjectComposer(false);
                      }}
                    >
                      <input
                        placeholder="Project title"
                        style={inputStyle}
                        value={projectForm.title}
                        onChange={(event) => setProjectForm((value) => ({ ...value, title: event.target.value }))}
                      />
                      <button className="button-primary" type="submit">
                        Save project
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>

              <div className="toolbar project-search-toolbar">
                <label className="filter-chip">
                  <p className="label">Project name</p>
                  <input
                    name="q"
                    value={projectSearch}
                    placeholder="Search project name"
                    style={inputStyle}
                    onChange={(event) => setProjectSearch(event.target.value)}
                  />
                </label>
              </div>

              <div className="inline-list" style={{ marginBottom: 20 }}>
                <span className="pill">Showing {recentProjects.length} project(s)</span>
                <span className="pill">{activeUsers.length} users</span>
              </div>

              <div className="stack">
                <div className="panel project-group-panel">
                  <button
                    type="button"
                    className="project-group-toggle project-group-toggle-wip"
                    onClick={() =>
                      setExpandedProjectGroups((value) => ({
                        ...value,
                        wip: !value.wip
                      }))
                    }
                  >
                    <div>
                      <p className="eyebrow">Projects</p>
                      <h3>WIP</h3>
                    </div>
                    <div className="project-group-meta">
                      <span className="pill">{wipProjectList.length}</span>
                      <span className="subtle">{expandedProjectGroups.wip ? "Hide" : "Show"}</span>
                    </div>
                  </button>
                  {expandedProjectGroups.wip ? (
                    wipProjectList.length === 0 ? (
                      <p className="subtle project-group-empty">No WIP projects found.</p>
                    ) : (
                      <div className="project-list project-group-list">
                        {wipProjectList.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            users={users}
                            canDelete={currentUser.role === "Admin"}
                            onDelete={async () => {
                              if (window.confirm(`Delete project "${project.title}"? This cannot be undone.`)) {
                                await deleteProject(project.id);
                              }
                            }}
                          />
                        ))}
                      </div>
                    )
                  ) : null}
                </div>

                <div className="panel project-group-panel">
                  <button
                    type="button"
                    className="project-group-toggle project-group-toggle-completed"
                    onClick={() =>
                      setExpandedProjectGroups((value) => ({
                        ...value,
                        completed: !value.completed
                      }))
                    }
                  >
                    <div>
                      <p className="eyebrow">Projects</p>
                      <h3>Completed</h3>
                    </div>
                    <div className="project-group-meta">
                      <span className="pill">{completedProjectList.length}</span>
                      <span className="subtle">{expandedProjectGroups.completed ? "Hide" : "Show"}</span>
                    </div>
                  </button>
                  {expandedProjectGroups.completed ? (
                    completedProjectList.length === 0 ? (
                      <p className="subtle project-group-empty">No completed projects found.</p>
                    ) : (
                      <div className="project-list project-group-list">
                        {completedProjectList.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            users={users}
                            canDelete={currentUser.role === "Admin"}
                            onDelete={async () => {
                              if (window.confirm(`Delete project "${project.title}"? This cannot be undone.`)) {
                                await deleteProject(project.id);
                              }
                            }}
                          />
                        ))}
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "users" ? (
            <div className="stack">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Admin controls</p>
                  <h3>{editingUserId ? "Edit user" : "Users"}</h3>
                </div>
                {editingUserId ? (
                  <button type="button" className="button-ghost" onClick={resetUserForm}>
                    Cancel edit
                  </button>
                ) : null}
              </div>

              <div className="stack">
                {!editingUserId ? (
                  <div className="inline-list">
                    <button
                      type="button"
                      className={`button-primary ${showUserComposer ? "button-muted" : ""}`}
                      onClick={() => setShowUserComposer((value) => !value)}
                    >
                      {showUserComposer ? "Hide form" : "Create User"}
                    </button>
                  </div>
                ) : null}

                {(showUserComposer || Boolean(editingUserId)) ? (
                  <form
                    className="stack"
                    onSubmit={async (event) => {
                      event.preventDefault();

                      if (editingUserId) {
                        await updateUser({
                          userId: editingUserId,
                          ...userForm
                        });
                      } else {
                        await createUser(userForm);
                      }

                      resetUserForm();
                    }}
                  >
                    <input
                      placeholder="Full name"
                      style={inputStyle}
                      value={userForm.name}
                      onChange={(event) => setUserForm((value) => ({ ...value, name: event.target.value }))}
                    />
                    <input
                      placeholder="Email"
                      style={inputStyle}
                      value={userForm.email}
                      onChange={(event) => setUserForm((value) => ({ ...value, email: event.target.value }))}
                    />
                    <input
                      type="password"
                      placeholder={editingUserId ? "New password (leave blank to keep current)" : "Password"}
                      style={inputStyle}
                      value={userForm.password}
                      onChange={(event) => setUserForm((value) => ({ ...value, password: event.target.value }))}
                    />
                    <select
                      style={inputStyle}
                      value={userForm.role}
                      onChange={(event) =>
                        setUserForm((value) => ({
                          ...value,
                          role: event.target.value as "Admin" | "Project Manager" | "Member"
                        }))
                      }
                    >
                      <option value="Member">Member</option>
                      <option value="Project Manager">Project Manager</option>
                      <option value="Admin">Admin</option>
                    </select>
                    <button className="button-primary" type="submit">
                      {editingUserId ? "Save changes" : "Create user"}
                    </button>
                  </form>
                ) : null}
              </div>

              <div className="stack">
                {activeUsers.map((user) => (
                  <div key={user.id} className="activity-item">
                    <div className="section-title" style={{ marginBottom: 8 }}>
                      <div>
                        <h3>{user.name}</h3>
                        <p className="subtle">{user.email}</p>
                      </div>
                      <div className="inline-list">
                        <span className="pill">{user.role}</span>
                        <span className="pill">{projectCountByUser[user.id] ?? 0} projects</span>
                      </div>
                    </div>

                    <div className="message-header" style={{ justifyContent: "space-between", gap: 12 }}>
                      <p className="subtle">
                        {user.id === currentUser.id ? "Currently signed in" : "Available for assignment"}
                      </p>
                      <div className="inline-list">
                        <button
                          type="button"
                          className="button-ghost"
                          onClick={() => {
                            setEditingUserId(user.id);
                            setShowUserComposer(true);
                            setUserForm({
                              name: user.name,
                              email: user.email,
                              password: "",
                              role: user.role
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button-ghost"
                          onClick={async () => {
                            if (editingUserId === user.id) {
                              resetUserForm();
                            }
                            if (window.confirm(`Delete user "${user.name}" from active users?`)) {
                              await deleteUser(user.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <div className="stack">
              {notifications.length === 0 ? (
                <div className="activity-item">
                  <p className="subtle">No recent activity.</p>
                </div>
              ) : (
                notifications.slice(0, 6).map((notification) => (
                  <div key={notification.id} className="activity-item">
                    <div className="section-title" style={{ marginBottom: 8 }}>
                      <h3>{notification.title}</h3>
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={() => dismissNotification(notification.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                    <p className="subtle">{notification.body}</p>
                    <p className="subtle" style={{ marginTop: 8 }}>
                      {formatDateTime(notification.at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ProjectCard({
  project,
  users,
  canDelete,
  onDelete
}: {
  project: Project;
  users: ReturnType<typeof useAppState>["users"];
  canDelete: boolean;
  onDelete: () => void;
}) {
  const pm = users.find((user) => user.id === project.projectManagerId);
  const openTasks = project.tasks.filter((task) => task.status !== "Done").length;
  const projectCost = getProjectEstimatedCost(project);

  return (
    <article className="project-card">
      <div className="section-title" style={{ marginBottom: 0 }}>
        <div>
          <div className="badge-row">
            <span className={`badge ${project.status === "Completed" ? "success" : "warning"}`}>
              {project.status}
            </span>
            <span className="badge">{project.code}</span>
            <span className="badge">{project.department}</span>
          </div>
          <h3 style={{ marginTop: 12 }}>{project.title}</h3>
        </div>
        <div className="project-side-badges">
          <span className="pill">{pm?.active === false ? "Former user" : pm?.name}</span>
          <span className="pill">{project.vendor}</span>
        </div>
      </div>

      <div className="project-metrics">
        <div className="project-metric-tile">
          <p className="label">Estimated cost</p>
          <p>{formatCurrency(projectCost)}</p>
        </div>
        <div className="project-metric-tile">
          <p className="label">Open tasks</p>
          <p>{openTasks}</p>
        </div>
        <div className="project-metric-tile">
          <p className="label">Created</p>
          <p>{formatDate(project.createdOn)}</p>
        </div>
        <div className="project-metric-tile">
          <p className="label">Target</p>
          <p>{formatDate(project.targetDate)}</p>
        </div>
      </div>

      <div className="card-actions">
        <Link href={`/projects/${project.id}`} className="button-secondary">
          Open project
        </Link>
        {canDelete ? (
          <button type="button" className="button-danger" onClick={onDelete}>
            Delete project
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="metric">
      <p className="label">{label}</p>
      <h2>{value}</h2>
      <p className="subtle">{note}</p>
    </div>
  );
}

function roleTitle(role: string) {
  if (role === "Admin") return "Admin Dashboard";
  if (role === "Project Manager") return "Project Manager Dashboard";
  return "Member Dashboard";
}

function heroTitle(role: string) {
  if (role === "Admin") return "School Operations Overview";
  if (role === "Project Manager") return "Project Delivery Overview";
  return "My Project Overview";
}

function menuHeading(tab: DashboardTab) {
  if (tab === "dashboard") return "Dashboard";
  if (tab === "projects") return "Projects";
  if (tab === "users") return "Users";
  return "Notifications";
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(31, 41, 51, 0.12)",
  background: "rgba(255,255,255,0.8)",
  font: "inherit",
  color: "inherit"
} as const;
