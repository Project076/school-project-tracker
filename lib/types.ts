export type UserRole = "Admin" | "Project Manager" | "Member";

export type ProjectStatus = "WIP" | "Completed";

export type AttachmentType = "PDF" | "DOCX" | "Image";
export type PaymentKind = "Advance" | "Payment";

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  active?: boolean;
}

export interface Task {
  id: string;
  title: string;
  ownerId: string;
  dueDate: string;
  estimatedCost: number;
  status: "Open" | "In Progress" | "Done";
}

export interface Attachment {
  id: string;
  name: string;
  type: AttachmentType;
  size: string;
  uploadedBy: string;
  mimeType?: string;
  dataUrl?: string;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName?: string;
  authorEmail?: string;
  body: string;
  sentAt: string;
  emailedTo: string[];
  cc: string[];
  direction: "App" | "Email";
  attachments: Attachment[];
  externalId?: string;
}

export interface PurchaseRequest {
  id: string;
  requestNumber: string;
  vendor: string;
  description: string;
  amount: number;
  raisedOn: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Ordered";
  payments?: PaymentEntry[];
}

export interface PaymentEntry {
  id: string;
  paidOn: string;
  amount: number;
  reference: string;
  kind: PaymentKind;
}

export interface Invoice {
  id: string;
  prId: string;
  againstType?: "PR" | "Advance";
  againstReference?: string;
  invoiceNumber: string;
  invoiceDate: string;
  vendorName: string;
  amount: number;
  narration: string;
  attachments: Attachment[];
  payments: PaymentEntry[];
}

export interface AuditEvent {
  id: string;
  actorId: string;
  message: string;
  at: string;
}

export interface Project {
  id: string;
  title: string;
  code: string;
  vendor: string;
  department: string;
  createdOn: string;
  startDate: string;
  targetDate: string;
  status: ProjectStatus;
  projectManagerId: string;
  memberIds: string[];
  estimatedCost: number;
  summary: string;
  tasks: Task[];
  messages: ChatMessage[];
  purchaseRequests: PurchaseRequest[];
  invoices: Invoice[];
  auditTrail: AuditEvent[];
}
