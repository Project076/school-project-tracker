import nodemailer from "nodemailer";

type OutboundChatEmailInput = {
  projectId: string;
  projectTitle: string;
  projectCode: string;
  authorName: string;
  authorEmail: string;
  body: string;
  history?: Array<{
    authorName: string;
    body: string;
    sentAt: string;
    direction: "App" | "Email";
  }>;
  to: string[];
  cc: string[];
};

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("Missing Gmail credentials.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass
    }
  });
}

export async function sendProjectChatEmail(input: OutboundChatEmailInput) {
  const transporter = getTransporter();
  const fromName = process.env.GMAIL_FROM_NAME || "School Project Tracker";
  const fromAddress = process.env.GMAIL_FROM_ADDRESS || process.env.GMAIL_USER || "no-reply@example.com";
  const projectReplyAddress = buildProjectReplyAddress(fromAddress, input.projectId);
  const threadToken = `project-thread:${input.projectId}`;
  const subject = `[${input.projectCode}] ${input.projectTitle}`;
  const history = input.history ?? [];
  const historyText = history.length
    ? `\n\nProject chat history:\n${history
        .map(
          (entry) =>
            `\n[${formatEmailDate(entry.sentAt)}] ${entry.authorName} (${entry.direction})\n${entry.body}`
        )
        .join("\n")}`
    : "";
  const historyHtml = history.length
    ? `
        <div style="margin-top: 16px;">
          <p style="margin: 0 0 8px;"><strong>Project chat history</strong></p>
          <div style="display: grid; gap: 10px;">
            ${history
              .map(
                (entry) => `
                  <div style="padding: 12px 14px; background: #fffaf3; border: 1px solid #eadfcd; border-radius: 10px;">
                    <p style="margin: 0 0 6px;"><strong>${escapeHtml(entry.authorName)}</strong> <span style="color: #6b7280;">(${escapeHtml(entry.direction)})</span></p>
                    <p style="margin: 0 0 6px; color: #6b7280; font-size: 12px;">${escapeHtml(formatEmailDate(entry.sentAt))}</p>
                    <div>${escapeHtml(entry.body).replace(/\n/g, "<br />")}</div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      `
    : "";

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.to.length ? input.to.join(", ") : undefined,
    cc: input.cc.length ? input.cc.join(", ") : undefined,
    replyTo: projectReplyAddress,
    subject,
    headers: {
      "X-Project-Id": input.projectId,
      "X-Project-Code": input.projectCode,
      "X-Project-Thread": threadToken
    },
    text:
      `${input.authorName} posted a new project update.\n\n` +
      `Project: ${input.projectTitle} (${input.projectCode})\n` +
      `Thread token: ${threadToken}\n` +
      `Reply address: ${projectReplyAddress}\n` +
      `Reply instruction: Please use Reply all and keep ${projectReplyAddress} in To/CC so the reply syncs back into the app.\n\n` +
      `${input.body}` +
      historyText,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933;">
        <p><strong>${input.authorName}</strong> posted a new project update.</p>
        <p><strong>Project:</strong> ${input.projectTitle} (${input.projectCode})</p>
        <p><strong>Thread token:</strong> ${threadToken}</p>
        <p><strong>Reply address:</strong> ${escapeHtml(projectReplyAddress)}</p>
        <div style="padding: 10px 12px; background: #eef6ff; border: 1px solid #c9dcf8; border-radius: 10px; margin-top: 10px;">
          <strong>Reply instruction:</strong> Please use <strong>Reply all</strong> and keep
          <strong> ${escapeHtml(projectReplyAddress)}</strong> in To/CC so the reply syncs back into the app.
        </div>
        <div style="padding: 12px 14px; background: #f7f1e7; border-radius: 10px; margin-top: 12px;">
          ${escapeHtml(input.body).replace(/\n/g, "<br />")}
        </div>
        ${historyHtml}
      </div>
    `
  });
}

function buildProjectReplyAddress(fromAddress: string, projectId: string) {
  const [localPart, domain] = fromAddress.split("@");

  if (!localPart || !domain) {
    return fromAddress;
  }

  if (domain.toLowerCase() === "gmail.com" || domain.toLowerCase() === "googlemail.com") {
    return `${localPart}+project-${projectId}@${domain}`;
  }

  return fromAddress;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatEmailDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
