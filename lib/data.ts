import { Project, User } from "@/lib/types";

export const users: User[] = [
  { id: "u1", name: "Asha Menon", email: "asha@school.org", password: "Admin@123", role: "Admin", active: true },
  { id: "u2", name: "Rahul Bose", email: "rahul@school.org", password: "Pm@123", role: "Project Manager", active: true },
  { id: "u3", name: "Priya Shah", email: "priya@school.org", password: "Member@123", role: "Member", active: true },
  { id: "u4", name: "Greenline Systems", email: "ops@greenline.example", password: "Vendor@123", role: "Member", active: true }
];

export const projects: Project[] = [
  {
    id: "p1",
    title: "STEM Lab Refurbishment",
    code: "SCH-24018",
    vendor: "Greenline Systems",
    department: "Science",
    createdOn: "2026-03-02",
    startDate: "2026-03-05",
    targetDate: "2026-04-15",
    status: "WIP",
    projectManagerId: "u2",
    memberIds: ["u1", "u3", "u4"],
    estimatedCost: 480000,
    summary:
      "Upgrade furniture, safety fixtures, and connected devices for the new STEM teaching block.",
    tasks: [
      {
        id: "t1",
        title: "Finalize workstation layout",
        ownerId: "u3",
        dueDate: "2026-03-28",
        estimatedCost: 35000,
        status: "In Progress"
      },
      {
        id: "t2",
        title: "Approve procurement package",
        ownerId: "u2",
        dueDate: "2026-03-30",
        estimatedCost: 220000,
        status: "Open"
      },
      {
        id: "t3",
        title: "Install projection and demo rig",
        ownerId: "u4",
        dueDate: "2026-04-07",
        estimatedCost: 145000,
        status: "Open"
      }
    ],
    messages: [
      {
        id: "m1",
        authorId: "u2",
        body:
          "Kickoff note shared in-app. The same update has been emailed to the vendor and internal stakeholders.",
        sentAt: "2026-03-12T09:30:00",
        emailedTo: ["ops@greenline.example"],
        cc: ["asha@school.org", "priya@school.org"],
        direction: "App",
        attachments: [
          {
            id: "a1",
            name: "site-plan.pdf",
            type: "PDF",
            size: "1.9 MB",
            uploadedBy: "u2"
          }
        ]
      },
      {
        id: "m2",
        authorId: "u4",
        body:
          "Reply received by email and synced back into the project timeline with the quoted thread stripped.",
        sentAt: "2026-03-12T11:02:00",
        emailedTo: [],
        cc: [],
        direction: "Email",
        attachments: [
          {
            id: "a2",
            name: "cabinet-finish.jpg",
            type: "Image",
            size: "780 KB",
            uploadedBy: "u4"
          }
        ]
      }
    ],
    purchaseRequests: [
      {
        id: "pr1",
        requestNumber: "PR-1048",
        vendor: "Greenline Systems",
        description: "Furniture, storage, and cable management",
        amount: 240000,
        raisedOn: "2026-03-10",
        status: "Approved",
        payments: [
          {
            id: "prpay1",
            paidOn: "2026-03-16",
            amount: 30000,
            reference: "Advance release",
            kind: "Advance"
          }
        ]
      },
      {
        id: "pr2",
        requestNumber: "PR-1055",
        vendor: "Vision Smart Tech",
        description: "Projection kit and presentation console",
        amount: 130000,
        raisedOn: "2026-03-14",
        status: "Pending Approval",
        payments: []
      }
    ],
    invoices: [
      {
        id: "i1",
        prId: "pr1",
        invoiceNumber: "INV-GL-882",
        invoiceDate: "2026-03-18",
        vendorName: "Greenline Systems",
        amount: 120000,
        narration: "Advance for modular tables and lockable cabinets",
        attachments: [
          {
            id: "ia1",
            name: "greenline-invoice.pdf",
            type: "PDF",
            size: "420 KB",
            uploadedBy: "u2"
          }
        ],
        payments: [
          {
            id: "pay1",
            paidOn: "2026-03-20",
            amount: 60000,
            reference: "UTR 98172654",
            kind: "Payment"
          }
        ]
      }
    ],
    auditTrail: [
      {
        id: "au1",
        actorId: "u2",
        message: "Project created and PM assigned",
        at: "2026-03-02T08:15:00"
      },
      {
        id: "au2",
        actorId: "u1",
        message: "Vendor Greenline Systems added to collaboration thread",
        at: "2026-03-08T15:20:00"
      }
    ]
  },
  {
    id: "p2",
    title: "Library Digitization Archive",
    code: "SCH-24003",
    vendor: "ArchiveWorks",
    department: "Library",
    createdOn: "2026-01-08",
    startDate: "2026-01-12",
    targetDate: "2026-02-20",
    status: "Completed",
    projectManagerId: "u2",
    memberIds: ["u1", "u3"],
    estimatedCost: 165000,
    summary: "Digitized old catalog cards and archived rare collection metadata.",
    tasks: [
      {
        id: "t4",
        title: "Catalog scan QA",
        ownerId: "u3",
        dueDate: "2026-02-06",
        estimatedCost: 20000,
        status: "Done"
      }
    ],
    messages: [
      {
        id: "m3",
        authorId: "u2",
        body: "Final sign-off collected. Project moved to completed by the assigned PM.",
        sentAt: "2026-02-21T10:15:00",
        emailedTo: ["archiveworks@example.com"],
        cc: ["asha@school.org"],
        direction: "App",
        attachments: []
      }
    ],
    purchaseRequests: [
      {
        id: "pr3",
        requestNumber: "PR-0981",
        vendor: "ArchiveWorks",
        description: "Scanning and indexing services",
        amount: 165000,
        raisedOn: "2026-01-15",
        status: "Approved",
        payments: []
      }
    ],
    invoices: [
      {
        id: "i2",
        prId: "pr3",
        invoiceNumber: "AW-2207",
        invoiceDate: "2026-02-18",
        vendorName: "ArchiveWorks",
        amount: 165000,
        narration: "Final project delivery invoice",
        attachments: [],
        payments: [
          {
            id: "pay2",
            paidOn: "2026-02-22",
            amount: 165000,
            reference: "UTR 81726354",
            kind: "Payment"
          }
        ]
      }
    ],
    auditTrail: [
      {
        id: "au3",
        actorId: "u2",
        message: "Project status changed from WIP to Completed",
        at: "2026-02-21T10:14:00"
      }
    ]
  }
];

export const currentUser = users[1];

export function getUser(userId: string) {
  return users.find((user) => user.id === userId);
}

export function getProject(projectId: string) {
  return projects.find((project) => project.id === projectId);
}

export function getBalanceDue(invoiceAmount: number, payments: { amount: number }[]) {
  return invoiceAmount - payments.reduce((total, payment) => total + payment.amount, 0);
}

export function getProjectEstimatedCost(project: { estimatedCost: number; tasks: { estimatedCost: number }[] }) {
  if (project.tasks.length === 0) {
    return project.estimatedCost;
  }

  return project.tasks.reduce((total, task) => total + task.estimatedCost, 0);
}

export function getTotalPaid(payments: { amount: number }[]) {
  return payments.reduce((total, payment) => total + payment.amount, 0);
}

export function getProjectRemainingCost(
  project: {
    estimatedCost: number;
    tasks: { estimatedCost: number }[];
    purchaseRequests: { payments?: { amount: number }[] }[];
    invoices: { payments: { amount: number }[] }[];
  }
) {
  const projectCost = getProjectEstimatedCost(project);
  const paidAgainstPrs = project.purchaseRequests.reduce(
    (total, pr) => total + getTotalPaid(pr.payments ?? []),
    0
  );
  const paidAgainstInvoices = project.invoices.reduce((total, invoice) => total + getTotalPaid(invoice.payments), 0);

  return Math.max(projectCost - (paidAgainstPrs + paidAgainstInvoices), 0);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(date));
}

export function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));
}
