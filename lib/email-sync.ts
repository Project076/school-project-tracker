import { ChatMessage } from "@/lib/types";

export type OutboundEmailPayload = {
  projectId: string;
  message: ChatMessage;
};

export type InboundEmailPayload = {
  projectId: string;
  from: string;
  subject: string;
  text: string;
  attachments: Array<{
    name: string;
    type: "PDF" | "DOCX" | "Image";
    size: string;
  }>;
};

export function buildOutboundEnvelope(payload: OutboundEmailPayload) {
  return {
    threadKey: `${payload.projectId}:${payload.message.id}`,
    to: payload.message.emailedTo,
    cc: payload.message.cc,
    subject: `[Project ${payload.projectId}] New chat update`,
    html: `<p>${payload.message.body}</p>`
  };
}

export function stripQuotedReply(text: string) {
  return text.split(/\nFrom:|\nOn .*wrote:/)[0].trim();
}

export function mapInboundToChat(payload: InboundEmailPayload): ChatMessage {
  return {
    id: `email-${payload.projectId}-${Date.now()}`,
    authorId: "u4",
    body: stripQuotedReply(payload.text),
    sentAt: new Date().toISOString(),
    emailedTo: [],
    cc: [],
    direction: "Email",
    attachments: payload.attachments.map((attachment, index) => ({
      id: `${payload.projectId}-att-${index + 1}`,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      uploadedBy: "u4"
    }))
  };
}
