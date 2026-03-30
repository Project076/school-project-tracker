"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAppState } from "@/components/app-state";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getProjectEstimatedCost
} from "@/lib/data";
import { PurchaseRequest, Task } from "@/lib/types";

type DetailTab = "chat" | "tasks" | "finance" | "history";
type FinanceComposer = "pr" | "invoice" | "payment" | null;

export function ProjectDetail({ projectId }: { projectId?: string } = {}) {
  const state = useAppState();
  const { isAuthenticated, syncInboundReplies } = state;
  const params = useParams<{ id: string }>();
  const resolvedProjectId = projectId ?? params.id;
  const project = state.projects.find((item) => item.id === resolvedProjectId);
  const [activeTab, setActiveTab] = useState<DetailTab>("chat");
  const [messageForm, setMessageForm] = useState({ body: "", emailedTo: [] as string[], cc: [] as string[] });
  const [showChatComposer, setShowChatComposer] = useState(false);
  const [toSearch, setToSearch] = useState("");
  const [ccSearch, setCcSearch] = useState("");
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    dueDate: "",
    estimatedCost: ""
  });
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [prForm, setPrForm] = useState({
    requestNumber: "",
    amount: ""
  });
  const [invoiceForm, setInvoiceForm] = useState({
    prId: project?.purchaseRequests[0]?.id ?? "",
    againstType: "PR" as "PR" | "Advance",
    againstReference: "",
    invoiceNumber: "",
    invoiceDate: "",
    amount: "",
    vendorName: "",
    narration: "",
    attachments: [] as Array<{
      name: string;
      type: "PDF" | "DOCX" | "Image";
      size: string;
    }>
  });
  const [paymentForm, setPaymentForm] = useState({
    prId: project?.purchaseRequests[0]?.id ?? "",
    invoiceId: project?.invoices[0]?.id ?? "",
    advanceMode: "New" as "New" | "Existing",
    advanceReference: "",
    paidOn: "",
    amount: "",
    kind: "Advance" as "Advance" | "Payment"
  });
  const [prFeedback, setPrFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [invoiceFeedback, setInvoiceFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [activeFinanceComposer, setActiveFinanceComposer] = useState<FinanceComposer>(null);
  const [completionMessage, setCompletionMessage] = useState("");
  const [expandedPurchaseRequests, setExpandedPurchaseRequests] = useState<Record<string, boolean>>({});
  const [expandedReferences, setExpandedReferences] = useState<Record<string, boolean>>({});
  const invoiceAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const chatBodyInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== "chat") {
      return;
    }

    void syncInboundReplies(resolvedProjectId);
    const intervalId = window.setInterval(() => {
      void syncInboundReplies(resolvedProjectId);
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, isAuthenticated, resolvedProjectId, syncInboundReplies]);

  if (!isAuthenticated) {
    return (
      <main className="page-shell">
        <div className="panel">
          <h2>Login required</h2>
          <p className="subtle" style={{ marginTop: 8 }}>Please sign in first to open project details.</p>
          <p style={{ marginTop: 16 }}><Link href="/">Return to sign in</Link></p>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="page-shell">
        <div className="panel">
          <h2>Project not found</h2>
          <p className="subtle" style={{ marginTop: 8 }}>The requested project does not exist.</p>
          <p style={{ marginTop: 16 }}><Link href="/">Return to dashboard</Link></p>
        </div>
      </main>
    );
  }

  const canViewProject =
    state.currentUser.role === "Admin" ||
    project.projectManagerId === state.currentUser.id ||
    project.memberIds.includes(state.currentUser.id);

  if (!canViewProject) {
    return (
      <main className="page-shell">
        <div className="panel">
          <h2>Access denied</h2>
          <p className="subtle" style={{ marginTop: 8 }}>You do not have permission to view this project.</p>
          <p style={{ marginTop: 16 }}><Link href="/">Return to dashboard</Link></p>
        </div>
      </main>
    );
  }

  const pm = state.users.find((user) => user.id === project.projectManagerId);
  const activeUsers = state.users.filter((user) => user.active !== false);
  const canManageFinance = state.currentUser.role === "Admin" || state.currentUser.id === project.projectManagerId;
  const canManageTasks = state.currentUser.role === "Admin" || state.currentUser.id === project.projectManagerId;
  const canToggleProjectStatus = state.currentUser.id === project.projectManagerId;
  const projectCost = getProjectEstimatedCost(project);
  const totalPrAmount = project.purchaseRequests.reduce((sum, request) => sum + request.amount, 0);
  const totalInvoiceAmount = project.invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalPaymentAmount =
    project.purchaseRequests.reduce(
      (sum, request) => sum + (request.payments ?? []).reduce((paid, payment) => paid + payment.amount, 0),
      0
    ) +
    project.invoices.reduce(
      (sum, invoice) => sum + invoice.payments.reduce((paid, payment) => paid + payment.amount, 0),
      0
    );
  const invoiceAdvanceReferences = getAdvanceReferencesForRequest(project, invoiceForm.prId);
  const paymentInvoices = project.invoices.filter((invoice) => invoice.prId === paymentForm.prId);
  const paymentAdvanceReferences = getAdvanceReferencesForRequest(project, paymentForm.prId);
  const canRecordInvoicePayment = paymentInvoices.length > 0;
  const selectedInvoiceFormReference =
    invoiceForm.invoiceNumber || invoiceForm.vendorName
      ? buildInvoiceReference(invoiceForm.invoiceNumber, invoiceForm.vendorName)
      : "";
  const selectedInvoiceRequest = project.purchaseRequests.find((request) => request.id === invoiceForm.prId);
  const selectedPaymentRequest = project.purchaseRequests.find((request) => request.id === paymentForm.prId);
  const selectedPaymentInvoice = project.invoices.find((invoice) => invoice.id === paymentForm.invoiceId);
  const paymentReferencePreview =
    paymentForm.kind === "Advance"
      ? paymentForm.advanceMode === "Existing" && paymentForm.advanceReference
        ? paymentForm.advanceReference
        : getNextAdvanceReferencePreview(selectedPaymentRequest)
      : buildInvoiceReference(selectedPaymentInvoice?.invoiceNumber, selectedPaymentInvoice?.vendorName);
  const reportRows = buildProjectReportRows(project);
  const filteredToUsers = toSearch
    ? activeUsers.filter(
        (user) =>
          !messageForm.emailedTo.includes(user.email) &&
          !messageForm.cc.includes(user.email) &&
          (user.name.toLowerCase().includes(toSearch.toLowerCase()) ||
            user.email.toLowerCase().includes(toSearch.toLowerCase()))
      )
    : [];
  const filteredCcUsers = ccSearch
    ? activeUsers.filter(
        (user) =>
          !messageForm.cc.includes(user.email) &&
          !messageForm.emailedTo.includes(user.email) &&
          (user.name.toLowerCase().includes(ccSearch.toLowerCase()) ||
            user.email.toLowerCase().includes(ccSearch.toLowerCase()))
      )
    : [];
  const selectedRecipients = useMemo(
    () =>
      activeUsers.filter(
        (user) => messageForm.emailedTo.includes(user.email) || messageForm.cc.includes(user.email)
      ),
    [activeUsers, messageForm.cc, messageForm.emailedTo]
  );
  const mentionableUsers = selectedRecipients.length > 0 ? selectedRecipients : activeUsers;
  const mentionSuggestions = mentionQuery
    ? mentionableUsers.filter((user) => user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : mentionableUsers;

  function syncMentionState(text: string, caret: number) {
    const mentionStart = text.lastIndexOf("@", Math.max(caret - 1, 0));
    const hasValidMention =
      mentionStart >= 0 &&
      mentionStart < caret &&
      (mentionStart === 0 || /\s/.test(text[mentionStart - 1])) &&
      !text.slice(mentionStart, caret).includes("\n");

    if (hasValidMention) {
      setMentionRange({ start: mentionStart, end: caret });
      setMentionQuery(text.slice(mentionStart + 1, caret));
    } else {
      setMentionRange(null);
      setMentionQuery("");
    }
  }

  return (
    <main className="page-shell detail-shell">
      <Link href="/" className="pill">Back to dashboard</Link>

      <section className="hero" style={{ marginTop: 18 }}>
        <div className="detail-header">
          <div className="stack">
            <div className="badge-row">
              <span className={`badge ${project.status === "Completed" ? "success" : "warning"}`}>{project.status}</span>
              <span className="badge">{project.code}</span>
              <span className="badge">{project.department}</span>
            </div>
            <h1 style={{ fontSize: "clamp(2rem, 3vw, 3.4rem)" }}>{project.title}</h1>
            <p className="subtle">{project.summary}</p>
          </div>
          <div className="panel" style={{ background: "rgba(255,255,255,0.5)" }}>
            <div className="mini-grid two">
              <div><p className="label">Project manager</p><p>{getVisibleUserName(pm)}</p></div>
              <div><p className="label">Vendor</p><p>{project.vendor}</p></div>
              <div><p className="label">Start date</p><p>{formatDate(project.startDate)}</p></div>
              <div><p className="label">Target date</p><p>{formatDate(project.targetDate)}</p></div>
            </div>
            <div className="inline-list" style={{ marginTop: 16 }}>
              {canToggleProjectStatus ? (
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setCompletionMessage(state.markCompleted(project.id).message)}
                >
                  {project.status === "Completed" ? "Move to WIP" : "Mark completed"}
                </button>
              ) : null}
              {completionMessage ? <span className="pill">{completionMessage}</span> : null}
            </div>
          </div>
        </div>

      </section>

      <section className="split-shell" style={{ marginTop: 20 }}>
        <aside className="sidebar-panel">
          <div className="section-title" style={{ marginBottom: 18 }}>
            <div>
              <p className="eyebrow">Project menu</p>
              <h2>{activeTab[0].toUpperCase() + activeTab.slice(1)}</h2>
            </div>
          </div>
          <div className="sidebar-menu">
            {(["chat", "tasks", "finance", "history"] as DetailTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`tab-button ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </aside>

        <div className="content-panel">
      {activeTab === "chat" ? (
        <section className="detail-grid">
          <div className="span-8 stack">
            <div className="panel">
              <div className="section-title">
                <div><p className="eyebrow">Communication</p><h2>Project chat</h2></div>
                <div className="inline-list">
                  <span className="pill">{project.messages.length} messages</span>
                  <span className="pill">Auto email sync on</span>
                </div>
              </div>
              <div className="conversation">
                <div className="inline-list">
                  <button
                    type="button"
                    className={`button-primary ${showChatComposer ? "" : "button-muted"}`}
                    onClick={() => setShowChatComposer((value) => !value)}
                  >
                    Chat
                  </button>
                </div>

                {showChatComposer ? (
                  <form
                    className="message"
                    onSubmit={(event) => {
                      event.preventDefault();
                      state.sendMessage(project.id, {
                        body: messageForm.body,
                        emailedTo: messageForm.emailedTo,
                        cc: messageForm.cc,
                        attachments: []
                      });
                      setMessageForm({ body: "", emailedTo: [], cc: [] });
                      setToSearch("");
                      setCcSearch("");
                      setMentionQuery("");
                      setMentionRange(null);
                    }}
                  >
                    <p className="eyebrow">Compose</p>
                    <div className="recipient-grid" style={{ marginTop: 12 }}>
                      <div className="recipient-panel">
                        <p className="label">To</p>
                        <input
                          style={{ ...formInputStyle, marginTop: 10 }}
                          placeholder="Type name or email"
                          value={toSearch}
                          onChange={(event) => setToSearch(event.target.value)}
                        />
                        {messageForm.emailedTo.length > 0 ? (
                          <div className="inline-list recipient-selected-list">
                            {messageForm.emailedTo.map((email) => {
                              const user = activeUsers.find((item) => item.email === email);

                              return (
                                <button
                                  key={`to-selected-${email}`}
                                  type="button"
                                  className="pill recipient-selected-pill"
                                  onClick={() =>
                                    setMessageForm((value) => ({
                                      ...value,
                                      emailedTo: value.emailedTo.filter((item) => item !== email)
                                    }))
                                  }
                                >
                                  {user?.name || email} - {email}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        {toSearch ? (
                          <div className="recipient-chip-list">
                            {filteredToUsers.map((user) => {
                            const selected = messageForm.emailedTo.includes(user.email);

                            return (
                              <button
                                key={`to-${user.id}`}
                                type="button"
                                className={`recipient-chip ${selected ? "selected" : ""}`}
                                onClick={() => {
                                  setMessageForm((value) => ({
                                    ...value,
                                    emailedTo: selected
                                      ? value.emailedTo.filter((email) => email !== user.email)
                                      : [...value.emailedTo, user.email],
                                    cc: value.cc.filter((email) => email !== user.email)
                                  }));
                                  setToSearch("");
                                }}
                              >
                                <span>{user.email}</span>
                                <small>{user.name}</small>
                              </button>
                            );
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className="recipient-panel">
                        <p className="label">CC</p>
                        <input
                          style={{ ...formInputStyle, marginTop: 10 }}
                          placeholder="Type name or email"
                          value={ccSearch}
                          onChange={(event) => setCcSearch(event.target.value)}
                        />
                        {messageForm.cc.length > 0 ? (
                          <div className="inline-list recipient-selected-list">
                            {messageForm.cc.map((email) => {
                              const user = activeUsers.find((item) => item.email === email);

                              return (
                                <button
                                  key={`cc-selected-${email}`}
                                  type="button"
                                  className="pill recipient-selected-pill"
                                  onClick={() =>
                                    setMessageForm((value) => ({
                                      ...value,
                                      cc: value.cc.filter((item) => item !== email)
                                    }))
                                  }
                                >
                                  {user?.name || email} - {email}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        {ccSearch ? (
                          <div className="recipient-chip-list">
                            {filteredCcUsers.map((user) => {
                            const selected = messageForm.cc.includes(user.email);

                            return (
                              <button
                                key={`cc-${user.id}`}
                                type="button"
                                className={`recipient-chip recipient-chip-cc ${selected ? "selected" : ""}`}
                                onClick={() => {
                                  setMessageForm((value) => ({
                                    ...value,
                                    cc: selected
                                      ? value.cc.filter((email) => email !== user.email)
                                      : [...value.cc, user.email],
                                    emailedTo: value.emailedTo.filter((email) => email !== user.email)
                                  }));
                                  setCcSearch("");
                                }}
                              >
                                <span>{user.email}</span>
                                <small>{user.name}</small>
                              </button>
                            );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="inline-list" style={{ marginTop: 12 }}>
                      <span className="pill">To: {messageForm.emailedTo.length}</span>
                      <span className="pill">CC: {messageForm.cc.length}</span>
                    </div>
                    <textarea
                      ref={chatBodyInputRef}
                      style={{ ...formInputStyle, minHeight: 100, marginTop: 12, resize: "vertical" }}
                      placeholder="Write a project update. Type @ to mention selected recipients"
                      value={messageForm.body}
                      onChange={(event) => {
                        const nextBody = event.target.value;
                        const caret = event.target.selectionStart ?? nextBody.length;

                        setMessageForm((value) => ({ ...value, body: nextBody }));
                        syncMentionState(nextBody, caret);
                      }}
                      onKeyUp={(event) => syncMentionState(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)}
                      onClick={(event) => syncMentionState(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)}
                    />
                    {mentionRange ? (
                      <div className="mention-box">
                        <p className="label">Mention someone</p>
                        <div className="mention-list">
                          {mentionSuggestions.length > 0 ? (
                            mentionSuggestions.map((user) => (
                              <button
                                key={`mention-${user.id}`}
                                type="button"
                                className="mention-option"
                                onClick={() => {
                                  if (!mentionRange) {
                                    return;
                                  }

                                  const insertedMention = `@${user.name} `;
                                  const updatedBody =
                                    `${messageForm.body.slice(0, mentionRange.start)}${insertedMention}${messageForm.body.slice(mentionRange.end)}`;
                                  const nextCursor = mentionRange.start + insertedMention.length;

                                  setMessageForm((value) => ({ ...value, body: updatedBody }));
                                  setMentionQuery("");
                                  setMentionRange(null);

                                  requestAnimationFrame(() => {
                                    if (chatBodyInputRef.current) {
                                      chatBodyInputRef.current.focus();
                                      chatBodyInputRef.current.setSelectionRange(nextCursor, nextCursor);
                                    }
                                  });
                                }}
                              >
                                <strong>{user.name}</strong>
                                <span>{user.email}</span>
                              </button>
                            ))
                          ) : (
                            <p className="subtle">No matching people found.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div className="inline-list" style={{ marginTop: 12 }}>
                      <button className="button-primary" type="submit">Send update</button>
                    </div>
                  </form>
                ) : null}

                {project.messages.map((message, index) => {
                  const author = state.users.find((user) => user.id === message.authorId);
                  const visibleAuthor =
                    message.direction === "Email"
                      ? message.authorName || message.authorEmail || "Email reply"
                      : getVisibleUserName(author);
                  return (
                    <article key={`${message.id}-${index}`} className="message">
                      <div className="message-header">
                        <div><p className="label">Author</p><p>{visibleAuthor}</p></div>
                        <div><p className="label">Direction</p><p>{message.direction}</p></div>
                        <div><p className="label">Sent</p><p>{formatDateTime(message.sentAt)}</p></div>
                        <div><p className="label">Recipients</p><p>{message.emailedTo.length ? message.emailedTo.join(", ") : "Reply"}</p></div>
                      </div>
                      <div className="divider" />
                      <p>{message.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "tasks" ? (
        <section className="detail-grid">
          <div className="span-8 stack">
            <div className="panel">
              <div className="section-title">
                <div><p className="eyebrow">Tasking</p><h2>Tasks</h2></div>
                <span className="pill">{project.tasks.length} tasks</span>
              </div>
              <div className="stack">
                {canManageTasks ? (
                  <div className="inline-list">
                    <button
                      type="button"
                      className={`button-secondary ${showTaskComposer ? "" : "button-muted"}`}
                      onClick={() => setShowTaskComposer((value) => !value)}
                    >
                      Create Task
                    </button>
                  </div>
                ) : null}

                {canManageTasks && showTaskComposer ? (
                  <form
                    className="task-item"
                    onSubmit={(event) => {
                      event.preventDefault();
                      state.addTask(project.id, {
                        title: taskForm.title,
                        ownerId: state.currentUser.id,
                        dueDate: taskForm.dueDate,
                        estimatedCost: Number(taskForm.estimatedCost)
                      });
                      setTaskForm((value) => ({ ...value, title: "", dueDate: "", estimatedCost: "" }));
                    }}
                  >
                    <p className="eyebrow">Add task</p>
                    <div className="stack" style={{ marginTop: 12 }}>
                      <input style={formInputStyle} placeholder="Task title" value={taskForm.title} onChange={(event) => setTaskForm((value) => ({ ...value, title: event.target.value }))} />
                      <div className="message-header">
                        <input type="date" style={formInputStyle} value={taskForm.dueDate} onChange={(event) => setTaskForm((value) => ({ ...value, dueDate: event.target.value }))} />
                        <input type="number" style={formInputStyle} placeholder="Estimated cost" value={taskForm.estimatedCost} onChange={(event) => setTaskForm((value) => ({ ...value, estimatedCost: event.target.value }))} />
                      </div>
                      <button className="button-secondary" type="submit">Add task</button>
                    </div>
                  </form>
                ) : null}

                <div className="finance-card">
                  <p className="label">Project cost from tasks</p>
                  <h3>{formatCurrency(projectCost)}</h3>
                  <p className="subtle" style={{ marginTop: 8 }}>
                    This total is calculated from the estimated cost of all project tasks.
                  </p>
                </div>

                <div className="task-list">
                  {project.tasks.map((task) => (
                    <div key={task.id} className="task-item">
                      <div className="task-row">
                        <div><p className="label">Task</p><p>{task.title}</p></div>
                        <div><p className="label">Estimated cost</p><p>{formatCurrency(task.estimatedCost)}</p></div>
                        <div><p className="label">Due</p><p>{formatDate(task.dueDate)}</p></div>
                        <div>
                          <p className="label">Status</p>
                          {canManageTasks ? (
                            <select
                              style={formInputStyle}
                              value={task.status}
                              onChange={(event) =>
                                state.updateTaskStatus(project.id, task.id, event.target.value as Task["status"])
                              }
                            >
                              <option value="Open">Open</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Done">Done</option>
                            </select>
                          ) : (
                            <p>{task.status}</p>
                          )}
                        </div>
                      </div>
                      {canManageTasks ? (
                        <div className="card-actions" style={{ marginTop: 12 }}>
                          <button
                            type="button"
                            className="button-danger"
                            onClick={() => {
                              if (window.confirm(`Delete task "${task.title}"?`)) {
                                state.deleteTask(project.id, task.id);
                              }
                            }}
                          >
                            Delete task
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "finance" ? (
        <section className="detail-grid">
          <div className="span-8 stack">
            <div className="panel">
              <div className="section-title">
                <div><p className="eyebrow">Finance</p><h2>Finance</h2></div>
                <span className={`pill ${canManageFinance ? "" : "subtle"}`}>{canManageFinance ? "Editable" : "Read only"}</span>
              </div>
              <div className="ledger-grid">
                <div className="finance-card ledger-hero">
                  <p className="label">Project cost from tasks</p>
                  <h3>{formatCurrency(projectCost)}</h3>
                  <p className="subtle">Estimated from all task costs.</p>
                </div>
                <div className="finance-card ledger-hero ledger-hero-success">
                  <p className="label">Total PR amount</p>
                  <h3>{formatCurrency(totalPrAmount)}</h3>
                  <p className="subtle">Total Invoice amount {formatCurrency(totalInvoiceAmount)}</p>
                  <p className="subtle">Total Payments {formatCurrency(totalPaymentAmount)}</p>
                </div>
              </div>

              <div className="finance-card" style={{ marginTop: 16 }}>
                <div className="section-title" style={{ marginBottom: 10 }}>
                  <div>
                    <p className="eyebrow">Report</p>
                    <h3>Finance export</h3>
                  </div>
                  <span className="pill">{reportRows.length} rows</span>
                </div>
                <div className="inline-list">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => downloadProjectReport(project, reportRows, "csv")}
                  >
                    Download CSV
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => downloadProjectReport(project, reportRows, "excel")}
                  >
                    Download Excel
                  </button>
                </div>
              </div>

              {canManageFinance ? (
                <div className="stack" style={{ marginTop: 16 }}>
                  <div className="inline-list">
                    <button
                      type="button"
                      className={`button-primary ${activeFinanceComposer === "pr" ? "" : "button-muted"}`}
                      onClick={() => setActiveFinanceComposer((value) => (value === "pr" ? null : "pr"))}
                    >
                      Create PR
                    </button>
                    <button
                      type="button"
                      className={`button-secondary ${activeFinanceComposer === "invoice" ? "" : "button-muted"}`}
                      onClick={() => setActiveFinanceComposer((value) => (value === "invoice" ? null : "invoice"))}
                    >
                      Create Invoice
                    </button>
                    <button
                      type="button"
                      className={`button-ghost ${activeFinanceComposer === "payment" ? "active-ghost" : ""}`}
                      onClick={() => setActiveFinanceComposer((value) => (value === "payment" ? null : "payment"))}
                    >
                      Create Payment
                    </button>
                  </div>

                  {activeFinanceComposer === "pr" ? (
                    <form
                      className="finance-card stack"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const result = state.addPurchaseRequest(project.id, {
                          requestNumber: prForm.requestNumber,
                          amount: Number(prForm.amount)
                        });
                        setPrFeedback(result);
                        if (result.ok) {
                          setPrForm({ requestNumber: "", amount: "" });
                        }
                      }}
                    >
                      <p className="eyebrow">Purchase request</p>
                      <input
                        style={formInputStyle}
                        placeholder="PR Number"
                        required
                        value={prForm.requestNumber}
                        onChange={(event) => setPrForm((value) => ({ ...value, requestNumber: event.target.value }))}
                      />
                      <input
                        type="number"
                        style={formInputStyle}
                        placeholder="Amount"
                        required
                        min="1"
                        value={prForm.amount}
                        onChange={(event) => setPrForm((value) => ({ ...value, amount: event.target.value }))}
                      />
                      {prFeedback ? (
                        <div className={`form-feedback ${prFeedback.ok ? "success" : "error"}`}>{prFeedback.message}</div>
                      ) : null}
                      <button type="submit" className="button-primary">Add PR</button>
                    </form>
                  ) : null}

                  {activeFinanceComposer === "invoice" ? (
                    <form
                      className="finance-card stack"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const result = state.addInvoice(project.id, {
                          prId: invoiceForm.prId,
                          againstType: invoiceForm.againstType,
                          againstReference:
                            invoiceForm.againstType === "Advance" ? invoiceForm.againstReference : undefined,
                          invoiceNumber: invoiceForm.invoiceNumber,
                          invoiceDate: invoiceForm.invoiceDate,
                          vendorName: invoiceForm.vendorName,
                          narration: invoiceForm.narration,
                          amount: Number(invoiceForm.amount),
                          attachments: invoiceForm.attachments
                        });
                        setInvoiceFeedback(result);
                        if (result.ok) {
                          setInvoiceForm((value) => ({
                            ...value,
                            againstType: "PR",
                            againstReference: "",
                            invoiceNumber: "",
                            invoiceDate: "",
                            amount: "",
                            vendorName: "",
                            narration: "",
                            attachments: []
                          }));
                          if (invoiceAttachmentInputRef.current) {
                            invoiceAttachmentInputRef.current.value = "";
                          }
                        }
                      }}
                    >
                      <p className="eyebrow">Invoice</p>
                      <select
                        style={formInputStyle}
                        required
                        value={invoiceForm.prId}
                        onChange={(event) =>
                          setInvoiceForm((value) => ({
                            ...value,
                            prId: event.target.value,
                            againstType: "PR",
                            againstReference: ""
                          }))
                        }
                      >
                        <option value="">Select PR</option>
                        {project.purchaseRequests.map((request) => (
                          <option key={request.id} value={request.id}>
                            {request.requestNumber}
                          </option>
                        ))}
                      </select>
                      <select
                        style={formInputStyle}
                        required
                        value={invoiceForm.againstType}
                        onChange={(event) =>
                          setInvoiceForm((value) => ({
                            ...value,
                            againstType: event.target.value as "PR" | "Advance",
                            againstReference: ""
                          }))
                        }
                      >
                        <option value="PR">Against PR Number</option>
                        <option value="Advance" disabled={invoiceAdvanceReferences.length === 0}>
                          Against Advance Payment
                        </option>
                      </select>
                      {invoiceForm.againstType === "Advance" ? (
                        <>
                          <select
                            style={formInputStyle}
                            required
                            value={invoiceForm.againstReference}
                            onChange={(event) =>
                              setInvoiceForm((value) => ({
                                ...value,
                                againstReference: event.target.value
                              }))
                            }
                          >
                            <option value="">Select Advance Reference</option>
                            {invoiceAdvanceReferences.map((reference) => (
                              <option key={reference} value={reference}>
                                {reference}
                              </option>
                            ))}
                          </select>
                          <p className="subtle">This invoice will be linked to the selected advance reference.</p>
                        </>
                      ) : (
                        <p className="subtle">
                          This invoice will be recorded against {selectedInvoiceRequest?.requestNumber || "the selected PR"}.
                        </p>
                      )}
                      <input
                        style={formInputStyle}
                        placeholder="Invoice Number"
                        required
                        value={invoiceForm.invoiceNumber}
                        onChange={(event) => setInvoiceForm((value) => ({ ...value, invoiceNumber: event.target.value }))}
                      />
                      <input
                        type="date"
                        style={formInputStyle}
                        required
                        value={invoiceForm.invoiceDate}
                        onChange={(event) => setInvoiceForm((value) => ({ ...value, invoiceDate: event.target.value }))}
                      />
                      {selectedInvoiceFormReference ? (
                        <div className="inline-list">
                          <span className="pill">Reference {selectedInvoiceFormReference}</span>
                          {invoiceForm.againstType === "Advance" && invoiceForm.againstReference ? (
                            <span className="pill">Against {invoiceForm.againstReference}</span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="invoice-attach-row">
                        <button
                          type="button"
                          className="button-ghost attach-button"
                          onClick={() => invoiceAttachmentInputRef.current?.click()}
                        >
                          <PaperclipIcon />
                          <span>Attach documents</span>
                        </button>
                        <input
                          ref={invoiceAttachmentInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,image/*"
                          style={{ display: "none" }}
                          onChange={(event) => {
                            const files = Array.from(event.target.files ?? []);
                            setInvoiceForm((value) => ({
                              ...value,
                              attachments: files.map((file) => ({
                                name: file.name,
                                type: getAttachmentType(file),
                                size: formatFileSize(file.size)
                              }))
                            }));
                          }}
                        />
                        {invoiceForm.attachments.length > 0 ? (
                          <span className="pill">{invoiceForm.attachments.length} file(s) attached</span>
                        ) : null}
                      </div>
                      {invoiceForm.attachments.length > 0 ? (
                        <div className="inline-list">
                          {invoiceForm.attachments.map((attachment) => (
                            <span key={attachment.name} className="pill">
                              {attachment.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="message-header">
                        <input
                          type="number"
                          style={formInputStyle}
                          placeholder="Amount"
                          required
                          min="1"
                          value={invoiceForm.amount}
                          onChange={(event) => setInvoiceForm((value) => ({ ...value, amount: event.target.value }))}
                        />
                        <input
                          style={formInputStyle}
                          placeholder="Vendor"
                          required
                          value={invoiceForm.vendorName}
                          onChange={(event) => setInvoiceForm((value) => ({ ...value, vendorName: event.target.value }))}
                        />
                      </div>
                      <textarea
                        style={{ ...formInputStyle, minHeight: 90, resize: "vertical" }}
                        placeholder="Narration"
                        required
                        value={invoiceForm.narration}
                        onChange={(event) => setInvoiceForm((value) => ({ ...value, narration: event.target.value }))}
                      />
                      {invoiceFeedback ? (
                        <div className={`form-feedback ${invoiceFeedback.ok ? "success" : "error"}`}>
                          {invoiceFeedback.message}
                        </div>
                      ) : null}
                      <button type="submit" className="button-secondary">Add invoice</button>
                    </form>
                  ) : null}

                  {activeFinanceComposer === "payment" ? (
                    <form
                      className="finance-card stack"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const result = state.addPayment(project.id, {
                          prId: paymentForm.prId,
                          invoiceId: paymentForm.kind === "Payment" ? paymentForm.invoiceId : undefined,
                          advanceMode: paymentForm.kind === "Advance" ? paymentForm.advanceMode : undefined,
                          advanceReference:
                            paymentForm.kind === "Advance" && paymentForm.advanceMode === "Existing"
                              ? paymentForm.advanceReference
                              : undefined,
                          paidOn: paymentForm.paidOn,
                          amount: Number(paymentForm.amount),
                          reference: paymentForm.kind === "Advance" ? "Advance payment" : "Due payment",
                          kind: paymentForm.kind
                        });
                        setPaymentFeedback(result);
                        if (result.ok) {
                          setPaymentForm((value) => ({
                            ...value,
                            paidOn: "",
                            amount: "",
                            invoiceId: paymentInvoices[0]?.id ?? "",
                            advanceMode: "New",
                            advanceReference: ""
                          }));
                        }
                      }}
                    >
                      <div className="section-title" style={{ marginBottom: 0 }}>
                        <div>
                          <p className="eyebrow">Transaction entry</p>
                          <h3>Advance or invoice payment</h3>
                        </div>
                      </div>
                      <div className="message-header">
                        <select
                          style={formInputStyle}
                          required
                          value={paymentForm.prId}
                          onChange={(event) => {
                            const nextInvoiceId =
                              project.invoices.find((invoice) => invoice.prId === event.target.value)?.id ?? "";
                            setPaymentForm({
                              prId: event.target.value,
                              invoiceId: nextInvoiceId,
                              advanceMode: "New",
                              advanceReference: "",
                              paidOn: paymentForm.paidOn,
                              amount: paymentForm.amount,
                              kind: nextInvoiceId ? paymentForm.kind : "Advance"
                            });
                          }}
                        >
                          <option value="">Select PR</option>
                          {project.purchaseRequests.map((request) => (
                            <option key={request.id} value={request.id}>
                              {request.requestNumber}
                            </option>
                          ))}
                        </select>
                        <select
                          style={formInputStyle}
                          required
                          value={paymentForm.kind}
                          onChange={(event) =>
                            setPaymentForm((value) => ({
                              ...value,
                              kind:
                                event.target.value === "Payment" && !canRecordInvoicePayment
                                  ? "Advance"
                                  : (event.target.value as "Advance" | "Payment"),
                              advanceMode:
                                event.target.value === "Advance" ? value.advanceMode : "New",
                              advanceReference: event.target.value === "Advance" ? value.advanceReference : ""
                            }))
                          }
                        >
                          <option value="Advance">Advance</option>
                          <option value="Payment" disabled={!canRecordInvoicePayment}>
                            Invoice payment
                          </option>
                        </select>
                      </div>
                      {!canRecordInvoicePayment ? (
                        <p className="subtle">
                          No invoice has been added for this PR yet, so only advance payment can be recorded right now.
                        </p>
                      ) : null}
                      {paymentReferencePreview ? <span className="pill">Reference {paymentReferencePreview}</span> : null}
                      {paymentForm.kind === "Advance" ? (
                        <>
                          <select
                            style={formInputStyle}
                            required
                            value={paymentForm.advanceMode}
                            onChange={(event) =>
                              setPaymentForm((value) => ({
                                ...value,
                                advanceMode: event.target.value as "New" | "Existing",
                                advanceReference: event.target.value === "Existing" ? value.advanceReference : ""
                              }))
                            }
                          >
                            <option value="New">New advance payment</option>
                            <option value="Existing" disabled={paymentAdvanceReferences.length === 0}>
                              Against already advance payment
                            </option>
                          </select>
                          {paymentForm.advanceMode === "Existing" ? (
                            <select
                              style={formInputStyle}
                              required
                              value={paymentForm.advanceReference}
                              onChange={(event) =>
                                setPaymentForm((value) => ({
                                  ...value,
                                  advanceReference: event.target.value
                                }))
                              }
                            >
                              <option value="">Select Advance Reference</option>
                              {paymentAdvanceReferences.map((reference) => (
                                <option key={reference} value={reference}>
                                  {reference}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </>
                      ) : null}
                      {paymentForm.kind === "Payment" && canRecordInvoicePayment ? (
                        <select
                          style={formInputStyle}
                          required
                          value={paymentForm.invoiceId}
                          onChange={(event) => setPaymentForm((value) => ({ ...value, invoiceId: event.target.value }))}
                        >
                          <option value="">Select Invoice</option>
                          {paymentInvoices.map((invoice) => (
                            <option key={invoice.id} value={invoice.id}>
                              {invoice.invoiceNumber}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <div className="message-header">
                        <input
                          type="date"
                          style={formInputStyle}
                          required
                          value={paymentForm.paidOn}
                          onChange={(event) => setPaymentForm((value) => ({ ...value, paidOn: event.target.value }))}
                        />
                        <input
                          type="number"
                          style={formInputStyle}
                          placeholder="Amount"
                          required
                          min="1"
                          value={paymentForm.amount}
                          onChange={(event) => setPaymentForm((value) => ({ ...value, amount: event.target.value }))}
                        />
                      </div>
                      {paymentFeedback ? (
                        <div className={`form-feedback ${paymentFeedback.ok ? "success" : "error"}`}>
                          {paymentFeedback.message}
                        </div>
                      ) : null}
                      <button type="submit" className="button-primary">
                        Add {paymentForm.kind === "Advance" ? "advance" : "invoice payment"}
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}

              <div className="stack" style={{ marginTop: 16 }}>
                {project.purchaseRequests.map((request) => {
                  const relatedInvoices = project.invoices.filter((invoice) => invoice.prId === request.id);
                  const prStatement = buildLinkedPrStatement(request, relatedInvoices);

                  return (
                    <div key={request.id} className="finance-card statement-shell">
                      <button
                        type="button"
                        className="purchase-request-toggle"
                        onClick={() =>
                          setExpandedPurchaseRequests((value) => ({
                            ...value,
                            [request.id]: !(value[request.id] ?? false)
                          }))
                        }
                      >
                        <div>
                          <p className="eyebrow">Purchase Request</p>
                          <h3 className="purchase-request-number">{request.requestNumber}</h3>
                        </div>
                        <div className="purchase-request-toggle-side">
                          <span className="badge warning">PR Amount {formatCurrency(request.amount)}</span>
                          <p className="subtle">
                            {(expandedPurchaseRequests[request.id] ?? false) ? "Hide details" : "Show details"}
                          </p>
                        </div>
                      </button>

                      {expandedPurchaseRequests[request.id] ?? false ? (
                        <>
                          <div className="ledger-grid compact">
                            <div className="statement-summary summary-purple">
                              <p className="label">Invoice total</p>
                              <div className="summary-breakdown">
                                <div className="summary-breakdown-row">
                                  <span>PR amount</span>
                                  <strong>{formatCurrency(request.amount)}</strong>
                                </div>
                                <div className="summary-breakdown-row">
                                  <span>Invoice total</span>
                                  <strong>{formatCurrency(prStatement.totalInvoiceAmount)}</strong>
                                </div>
                                <div className="summary-breakdown-row">
                                  <span>Remaining PR amount</span>
                                  <strong>{formatCurrency(prStatement.remainingPrAmount)}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="statement-summary summary-green">
                              <p className="label">Payment</p>
                              <div className="summary-breakdown">
                                <div className="summary-breakdown-row">
                                  <span>Payment</span>
                                  <strong>{formatCurrency(prStatement.totalInvoicePayments)}</strong>
                                </div>
                                <div className="summary-breakdown-row">
                                  <span>Advance</span>
                                  <strong>{formatCurrency(prStatement.totalAdvanceAmount)}</strong>
                                </div>
                                <div className="summary-breakdown-row">
                                  <span>Total</span>
                                  <strong>{formatCurrency(prStatement.totalPayments)}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="statement-summary summary-orange">
                              <p className="label">Balance due</p>
                              <div className="summary-breakdown">
                                <div className="summary-breakdown-row">
                                  <span>PR balance</span>
                                  <strong>{formatCurrency(prStatement.prBalance)}</strong>
                                </div>
                                <div className="summary-breakdown-row">
                                  <span>Invoice balance</span>
                                  <strong>{formatCurrency(prStatement.invoiceBalance)}</strong>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="statement-list">
                            {prStatement.references.length === 0 ? (
                              <div className="statement-row statement-neutral">
                                <div>
                                  <p className="label">No transactions yet</p>
                                  <p className="subtle">Add an advance, invoice, or payment to start the statement.</p>
                                </div>
                              </div>
                            ) : (
                              prStatement.references.map((reference) => {
                                const isExpanded = expandedReferences[reference.reference] ?? false;

                                return (
                                  <div key={reference.reference} className={`reference-card ${reference.tone}`}>
                                    <button
                                      type="button"
                                      className="reference-toggle"
                                      onClick={() =>
                                        setExpandedReferences((value) => ({
                                          ...value,
                                          [reference.reference]: !isExpanded
                                        }))
                                      }
                                    >
                                      <div>
                                        <p className="label">Reference</p>
                                        <h4>{reference.reference}</h4>
                                        <p className="subtle">{reference.subtitle}</p>
                                      </div>
                                      <div className="statement-values">
                                        <p className="subtle">{reference.summaryText}</p>
                                        <p className="subtle">{isExpanded ? "Hide details" : "Show details"}</p>
                                      </div>
                                    </button>

                                    {isExpanded ? (
                                      <div className="reference-details">
                                        <div className="reference-ledger-card">
                                        {reference.entries.map((entry) => (
                                          <div key={entry.id} className={`statement-row statement-strip ${entry.tone}`}>
                                            <div>
                                              <p className="label">{entry.label}</p>
                                              <h4>{entry.title}</h4>
                                              <p className="subtle">{formatDate(entry.date)}</p>
                                              {entry.attachments?.length ? (
                                                <p className="subtle">{entry.attachments.length} attachment(s)</p>
                                              ) : null}
                                            </div>
                                            <div className="statement-values">
                                              <p className="statement-amount">{formatCurrency(entry.amount)}</p>
                                              <p className="subtle">{entry.trailingLabel} {formatCurrency(entry.trailingAmount)}</p>
                                              {canManageFinance && (entry.label === "Invoice" || entry.label === "Payment" || entry.label === "Advance") ? (
                                                <button
                                                  type="button"
                                                  className="button-danger ledger-delete-button"
                                                  onClick={() => {
                                                    if (
                                                      window.confirm(
                                                        `Delete ${entry.label.toLowerCase()} "${entry.title}"?`
                                                      )
                                                    ) {
                                                      if (entry.label === "Invoice") {
                                                        state.deleteInvoice(project.id, entry.id);
                                                      } else {
                                                        state.deletePayment(project.id, entry.id);
                                                      }
                                                    }
                                                  }}
                                                >
                                                  Delete
                                                </button>
                                              ) : null}
                                            </div>
                                          </div>
                                        ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="detail-grid">
          <div className="span-8 stack">
            <div className="panel">
              <div className="section-title">
                <div><p className="eyebrow">Audit Trail</p><h2>Status history</h2></div>
              </div>
              <div className="stack">
                {project.auditTrail.map((event) => (
                  <div key={event.id} className="activity-item">
                    <p>{event.message}</p>
                    <p className="subtle" style={{ marginTop: 8 }}>
                      {getVisibleUserName(state.users.find((user) => user.id === event.actorId))} - {formatDateTime(event.at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
        </div>
      </section>
    </main>
  );
}

function splitEmails(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

type ReportRow = {
  projectName: string;
  type: "PR" | "Invoice" | "Payment";
  number: string;
  date: string;
  amount: number;
  vendorName: string;
  narration: string;
};

function getVisibleUserName(user?: { name: string; active?: boolean }) {
  if (!user) {
    return "External sender";
  }

  return user.active === false ? "Former user" : user.name;
}

function buildPrStatement(request: PurchaseRequest, invoices: Array<{
  id: string;
  againstType?: "PR" | "Advance";
  againstReference?: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  vendorName: string;
  attachments: Array<{ id: string }>;
  payments: Array<{ id: string; paidOn: string; amount: number }>;
}>) {
  const advanceGroups = getAdvanceReferenceGroups(request);
  const advanceReferences = advanceGroups.map(([reference, payments]) => {
    const linkedInvoices = invoices.filter(
      (invoice) => invoice.againstType === "Advance" && invoice.againstReference === reference
    );
    const advanceTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const linkedInvoiceTotal = linkedInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const linkedInvoicePayments = linkedInvoices.reduce(
      (sum, invoice) => sum + invoice.payments.reduce((paid, payment) => paid + payment.amount, 0),
      0
    );

    const advanceEntries = [...payments]
      .sort((left, right) => new Date(left.paidOn).getTime() - new Date(right.paidOn).getTime())
      .map((payment, index, rows) => ({
        id: payment.id,
        date: payment.paidOn,
        label: "Advance",
        title:
          request.vendor && request.vendor !== "To be added from invoice"
            ? `Advance released to ${request.vendor}`
            : "Advance released against PR",
        amount: payment.amount,
        trailingLabel: "Advance total",
        trailingAmount: rows.slice(0, index + 1).reduce((sum, row) => sum + row.amount, 0),
        tone: "statement-advance",
        attachments: [] as Array<{ id: string }>
      }));

    const linkedInvoiceEntries = linkedInvoices.flatMap((invoice) => {
      let remaining = invoice.amount;
      const invoiceEntry = {
        id: invoice.id,
        date: invoice.invoiceDate,
        label: "Invoice",
        title: `${invoice.invoiceNumber} - ${invoice.vendorName}`,
        amount: invoice.amount,
        trailingLabel: "Balance",
        trailingAmount: invoice.amount,
        tone: "statement-invoice",
        attachments: invoice.attachments
      };

      const paymentEntries = [...invoice.payments]
        .sort((left, right) => new Date(left.paidOn).getTime() - new Date(right.paidOn).getTime())
        .map((payment) => {
          remaining -= payment.amount;

          return {
            id: payment.id,
            date: payment.paidOn,
            label: "Payment",
            title: `Payment against ${invoice.invoiceNumber}`,
            amount: payment.amount,
            trailingLabel: "Balance",
            trailingAmount: Math.max(remaining, 0),
            tone: "statement-payment",
            attachments: [] as Array<{ id: string }>
          };
        });

      return [invoiceEntry, ...paymentEntries];
    });

    return {
      reference,
      subtitle:
        linkedInvoices.length > 0
          ? `${request.vendor} | Linked invoice flow`
          : request.vendor && request.vendor !== "To be added from invoice"
            ? request.vendor
            : "Advance payment",
      totalAmount: advanceTotal,
      balanceToPay: Math.max(linkedInvoiceTotal - linkedInvoicePayments, 0),
      summaryText:
        linkedInvoices.length > 0
          ? `Balance to pay ${formatCurrency(Math.max(linkedInvoiceTotal - linkedInvoicePayments, 0))}`
          : `Advance amount ${formatCurrency(advanceTotal)}`,
      tone: "statement-advance",
      entries: [...advanceEntries, ...linkedInvoiceEntries].sort(
        (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
      )
    };
  });

  const invoiceReferences = invoices
    .filter((invoice) => !(invoice.againstType === "Advance" && invoice.againstReference))
    .map((invoice) => {
    let remaining = invoice.amount;
    const entries = [
      {
        id: invoice.id,
        date: invoice.invoiceDate,
        label: "Invoice",
        title: `${invoice.invoiceNumber} - ${invoice.vendorName}`,
        amount: invoice.amount,
        trailingLabel: "Balance",
        trailingAmount: invoice.amount,
        tone: "statement-invoice",
        attachments: invoice.attachments
      }
    ];

    const paymentRows = [...invoice.payments]
      .sort((left, right) => new Date(left.paidOn).getTime() - new Date(right.paidOn).getTime())
      .map((payment) => {
        remaining -= payment.amount;

        return {
          id: payment.id,
          date: payment.paidOn,
          label: "Payment",
          title: `Payment against ${invoice.invoiceNumber}`,
          amount: payment.amount,
          trailingLabel: "Balance",
          trailingAmount: Math.max(remaining, 0),
          tone: "statement-payment",
          attachments: [] as Array<{ id: string }>
        };
      });

    return {
      reference: buildInvoiceReference(invoice.invoiceNumber, invoice.vendorName),
      subtitle:
        invoice.againstType === "Advance" && invoice.againstReference
          ? `${invoice.vendorName} · Against ${invoice.againstReference}`
          : `${invoice.vendorName} · Against ${request.requestNumber}`,
      totalAmount: invoice.amount,
      balanceToPay: Math.max(remaining, 0),
      tone: "statement-invoice",
      entries: [...entries, ...paymentRows]
    };
    });
  const totalInvoiceAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalAdvanceAmount = (request.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
  const totalInvoicePayments = invoices.reduce(
    (sum, invoice) => sum + invoice.payments.reduce((paid, entry) => paid + entry.amount, 0),
    0
  );
  const totalPayments = totalAdvanceAmount + totalInvoicePayments;
  const remainingPrAmount = Math.max(request.amount - totalInvoiceAmount, 0);
  const prBalance = Math.max(request.amount - totalPayments, 0);
  const invoiceBalance = Math.max(totalInvoiceAmount - totalInvoicePayments, 0);

  const references = [
    ...advanceReferences,
    ...invoiceReferences
  ];

  return {
    references,
    totalInvoiceAmount,
    totalAdvanceAmount,
    totalInvoicePayments,
    totalPayments,
    remainingPrAmount,
    prBalance,
    invoiceBalance
  };
}

function buildLinkedPrStatement(request: PurchaseRequest, invoices: Array<{
  id: string;
  againstType?: "PR" | "Advance";
  againstReference?: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  vendorName: string;
  attachments: Array<{ id: string }>;
  payments: Array<{ id: string; paidOn: string; amount: number }>;
}>) {
  const advanceGroups = getAdvanceReferenceGroups(request);
  const advanceReferences = advanceGroups.map(([reference, payments]) => {
    const linkedInvoices = invoices.filter(
      (invoice) => invoice.againstType === "Advance" && invoice.againstReference === reference
    );
    const advanceTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const linkedInvoiceTotal = linkedInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const linkedInvoicePayments = linkedInvoices.reduce(
      (sum, invoice) => sum + invoice.payments.reduce((paid, payment) => paid + payment.amount, 0),
      0
    );

    const advanceEntries = [...payments]
      .sort((left, right) => new Date(left.paidOn).getTime() - new Date(right.paidOn).getTime())
      .map((payment, index, rows) => ({
        id: payment.id,
        date: payment.paidOn,
        label: "Advance",
        title:
          request.vendor && request.vendor !== "To be added from invoice"
            ? `Advance released to ${request.vendor}`
            : "Advance released against PR",
        amount: payment.amount,
        trailingLabel: "Advance total",
        trailingAmount: rows.slice(0, index + 1).reduce((sum, row) => sum + row.amount, 0),
        tone: "statement-advance",
        attachments: [] as Array<{ id: string }>
      }));

    const linkedInvoiceEntries = linkedInvoices.flatMap((invoice) => {
      let remaining = invoice.amount;
      const invoiceEntry = {
        id: invoice.id,
        date: invoice.invoiceDate,
        label: "Invoice",
        title: `${invoice.invoiceNumber} - ${invoice.vendorName}`,
        amount: invoice.amount,
        trailingLabel: "Balance",
        trailingAmount: invoice.amount,
        tone: "statement-invoice",
        attachments: invoice.attachments
      };

      const paymentEntries = [...invoice.payments]
        .sort((left, right) => new Date(left.paidOn).getTime() - new Date(right.paidOn).getTime())
        .map((payment) => {
          remaining -= payment.amount;

          return {
            id: payment.id,
            date: payment.paidOn,
            label: "Payment",
            title: `Payment against ${invoice.invoiceNumber}`,
            amount: payment.amount,
            trailingLabel: "Balance",
            trailingAmount: Math.max(remaining, 0),
            tone: "statement-payment",
            attachments: [] as Array<{ id: string }>
          };
        });

      return [invoiceEntry, ...paymentEntries];
    });

    return {
      reference,
      subtitle:
        linkedInvoices.length > 0
          ? `${request.vendor} | Linked invoice flow`
          : request.vendor && request.vendor !== "To be added from invoice"
            ? request.vendor
            : "Advance payment",
      totalAmount: advanceTotal,
      balanceToPay: Math.max(linkedInvoiceTotal - linkedInvoicePayments, 0),
      summaryText:
        linkedInvoices.length > 0
          ? `Balance to pay ${formatCurrency(Math.max(linkedInvoiceTotal - linkedInvoicePayments, 0))}`
          : `Advance amount ${formatCurrency(advanceTotal)}`,
      tone: "statement-advance",
      entries: [...advanceEntries, ...linkedInvoiceEntries].sort(
        (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
      )
    };
  });

  const invoiceReferences = invoices
    .filter((invoice) => !(invoice.againstType === "Advance" && invoice.againstReference))
    .map((invoice) => {
      let remaining = invoice.amount;
      const entries = [
        {
          id: invoice.id,
          date: invoice.invoiceDate,
          label: "Invoice",
          title: `${invoice.invoiceNumber} - ${invoice.vendorName}`,
          amount: invoice.amount,
          trailingLabel: "Balance",
          trailingAmount: invoice.amount,
          tone: "statement-invoice",
          attachments: invoice.attachments
        }
      ];

      const paymentRows = [...invoice.payments]
        .sort((left, right) => new Date(left.paidOn).getTime() - new Date(right.paidOn).getTime())
        .map((payment) => {
          remaining -= payment.amount;

          return {
            id: payment.id,
            date: payment.paidOn,
            label: "Payment",
            title: `Payment against ${invoice.invoiceNumber}`,
            amount: payment.amount,
            trailingLabel: "Balance",
            trailingAmount: Math.max(remaining, 0),
            tone: "statement-payment",
            attachments: [] as Array<{ id: string }>
          };
        });

      return {
        reference: buildInvoiceReference(invoice.invoiceNumber, invoice.vendorName),
        subtitle: `${invoice.vendorName} | Against ${request.requestNumber}`,
        totalAmount: invoice.amount,
        balanceToPay: Math.max(remaining, 0),
        summaryText: `Balance to pay ${formatCurrency(Math.max(remaining, 0))}`,
        tone: "statement-invoice",
        entries: [...entries, ...paymentRows]
      };
    });

  const totalInvoiceAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalAdvanceAmount = (request.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
  const totalInvoicePayments = invoices.reduce(
    (sum, invoice) => sum + invoice.payments.reduce((paid, entry) => paid + entry.amount, 0),
    0
  );
  const totalPayments = totalAdvanceAmount + totalInvoicePayments;
  const remainingPrAmount = Math.max(request.amount - totalInvoiceAmount, 0);
  const prBalance = Math.max(request.amount - totalPayments, 0);
  const invoiceBalance = Math.max(totalInvoiceAmount - totalInvoicePayments, 0);

  return {
    references: [...advanceReferences, ...invoiceReferences],
    totalInvoiceAmount,
    totalAdvanceAmount,
    totalInvoicePayments,
    totalPayments,
    remainingPrAmount,
    prBalance,
    invoiceBalance
  };
}

function getAttachmentType(file: File): "PDF" | "DOCX" | "Image" {
  const name = file.name.toLowerCase();

  if (file.type.startsWith("image/")) {
    return "Image";
  }

  if (name.endsWith(".pdf")) {
    return "PDF";
  }

  return "DOCX";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildAdvanceReference(vendorName?: string) {
  return `ADV | ${vendorName && vendorName !== "To be added from invoice" ? vendorName : "Vendor Pending"}`;
}

function buildIndexedAdvanceReference(vendorName: string, index: number) {
  const normalizedVendor = vendorName && vendorName !== "To be added from invoice" ? vendorName : "Vendor Pending";
  return index <= 1 ? buildAdvanceReference(normalizedVendor) : `ADV-${index} | ${normalizedVendor}`;
}

function getAdvanceReferencesForRequest(project: {
  purchaseRequests: PurchaseRequest[];
}, prId: string) {
  const request = project.purchaseRequests.find((entry) => entry.id === prId);
  if (!request) {
    return [];
  }

  return Array.from(
    new Set((request.payments ?? []).filter((payment) => payment.kind === "Advance").map((payment) => payment.reference))
  );
}

function getAdvanceReferenceGroups(request: PurchaseRequest) {
  return Array.from(
    (request.payments ?? [])
      .filter((payment) => payment.kind === "Advance")
      .reduce((groups, payment) => {
        const rows = groups.get(payment.reference) ?? [];
        rows.push(payment);
        groups.set(payment.reference, rows);
        return groups;
      }, new Map<string, NonNullable<PurchaseRequest["payments"]>>())
      .entries()
  );
}

function getNextAdvanceReferencePreview(request?: PurchaseRequest) {
  if (!request) {
    return buildAdvanceReference();
  }

  return buildIndexedAdvanceReference(request.vendor, getAdvanceReferencesForRequest({ purchaseRequests: [request] }, request.id).length + 1);
}

function buildProjectReportRows(project: NonNullable<ReturnType<typeof useAppState>["projects"][number]>) {
  const prRows: ReportRow[] = project.purchaseRequests.map((request) => ({
    projectName: project.title,
    type: "PR",
    number: request.requestNumber,
    date: request.raisedOn,
    amount: request.amount,
    vendorName: request.vendor === "To be added from invoice" ? "" : request.vendor,
    narration: request.description || ""
  }));

  const invoiceRows: ReportRow[] = project.invoices.map((invoice) => ({
    projectName: project.title,
    type: "Invoice",
    number: invoice.invoiceNumber,
    date: invoice.invoiceDate,
    amount: invoice.amount,
    vendorName: invoice.vendorName,
    narration: invoice.narration
  }));

  const paymentRows: ReportRow[] = [
    ...project.purchaseRequests.flatMap((request) =>
      (request.payments ?? []).map((payment) => ({
        projectName: project.title,
        type: "Payment" as const,
        number: "",
        date: payment.paidOn,
        amount: payment.amount,
        vendorName: request.vendor === "To be added from invoice" ? "" : request.vendor,
        narration: payment.kind === "Advance" ? `Advance payment (${payment.reference})` : payment.reference
      }))
    ),
    ...project.invoices.flatMap((invoice) =>
      invoice.payments.map((payment) => ({
        projectName: project.title,
        type: "Payment" as const,
        number: "",
        date: payment.paidOn,
        amount: payment.amount,
        vendorName: invoice.vendorName,
        narration: `Payment against ${invoice.invoiceNumber}`
      }))
    )
  ];

  return [...prRows, ...invoiceRows, ...paymentRows].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
  );
}

function downloadProjectReport(
  project: NonNullable<ReturnType<typeof useAppState>["projects"][number]>,
  rows: ReportRow[],
  format: "csv" | "excel"
) {
  const columns = ["Project Name", "Type", "Number", "Date", "Amount", "Vendor Name", "Narration"] as const;
  const tableRows = rows.map((row) => [
    row.projectName,
    row.type,
    row.number,
    row.date,
    row.amount.toString(),
    row.vendorName,
    row.narration
  ]);

  const fileBase = `${project.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase()}-finance-report`;

  if (format === "csv") {
    const csv = [columns.join(","), ...tableRows.map((row) => row.map(escapeCsvCell).join(","))].join("\n");
    triggerDownload(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }), `${fileBase}.csv`);
    return;
  }

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
      th { background: #e2e8f0; font-weight: 700; }
    </style>
  </head>
  <body>
    <table>
      <thead>
        <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${tableRows
          .map(
            (row) =>
              `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
  </body>
</html>`;

  triggerDownload(
    new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" }),
    `${fileBase}.xls`
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildInvoiceReference(invoiceNumber?: string, vendorName?: string) {
  return `${invoiceNumber || "Invoice"} | ${vendorName || "Vendor Pending"}`;
}

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.5 6.5 9 14a3.5 3.5 0 1 0 5 5l8-8a5.5 5.5 0 1 0-7.8-7.8L5.8 11.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const formInputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(31, 41, 51, 0.12)",
  background: "rgba(255,255,255,0.88)",
  font: "inherit",
  color: "inherit"
} as const;
