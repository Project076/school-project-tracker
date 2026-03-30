import { promises as fs } from "fs";
import path from "path";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export type SyncedEmailReply = {
  externalId: string;
  projectId: string;
  authorName: string;
  authorEmail: string;
  body: string;
  sentAt: string;
  subject: string;
};

type EmailSyncStore = {
  lastUid: number;
  replies: SyncedEmailReply[];
};

const storePath = path.join(process.cwd(), "server-data", "gmail-replies.json");

export async function syncInboundRepliesFromGmail() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("Missing Gmail credentials for inbound sync.");
  }

  const store = await readStore();
  let maxUid = store.lastUid;
  const knownExternalIds = new Set(store.replies.map((reply) => reply.externalId));
  const discoveredReplies: SyncedEmailReply[] = [];
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user,
      pass
    }
  });

  await client.connect();
  const mailboxLock = await client.getMailboxLock("INBOX");

  try {
    const rangeStart = Math.max(store.lastUid + 1, 1);

    for await (const message of client.fetch(`${rangeStart}:*`, {
      uid: true,
      envelope: true,
      source: true,
      internalDate: true
    })) {
      maxUid = Math.max(maxUid, message.uid);

      const parsed = await simpleParser(message.source);
      const projectId = extractProjectId(message.envelope?.to ?? [], parsed.to?.value ?? [], parsed.cc?.value ?? []);
      if (!projectId) {
        continue;
      }

      const externalId = parsed.messageId || `imap-${message.uid}`;
      if (knownExternalIds.has(externalId)) {
        continue;
      }

      const author = parsed.from?.value?.[0];
      const authorEmail = author?.address ?? "external-reply@example.com";
      if (authorEmail.toLowerCase() === user.toLowerCase()) {
        continue;
      }

      const body = extractLatestReply(parsed.text || "");
      if (!body) {
        continue;
      }

      const reply: SyncedEmailReply = {
        externalId,
        projectId,
        authorName: author?.name || authorEmail,
        authorEmail,
        body,
        sentAt: parsed.date?.toISOString() ?? message.internalDate.toISOString(),
        subject: parsed.subject || ""
      };

      discoveredReplies.push(reply);
      knownExternalIds.add(externalId);
    }
  } finally {
    mailboxLock.release();
    await client.logout();
  }

  if (discoveredReplies.length > 0 || maxUid !== store.lastUid) {
    await writeStore({
      lastUid: maxUid,
      replies: [...store.replies, ...discoveredReplies]
    });
  }

  return discoveredReplies;
}

export async function getRepliesForProject(projectId: string) {
  const store = await readStore();
  return store.replies.filter((reply) => reply.projectId === projectId);
}

async function readStore(): Promise<EmailSyncStore> {
  try {
    const content = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(content) as EmailSyncStore;

    return {
      lastUid: parsed.lastUid ?? 0,
      replies: parsed.replies ?? []
    };
  } catch {
    return {
      lastUid: 0,
      replies: []
    };
  }
}

async function writeStore(store: EmailSyncStore) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

function extractProjectId(
  envelopeTo: Array<{ address?: string | null }> = [],
  parsedTo: Array<{ address?: string | null }> = [],
  parsedCc: Array<{ address?: string | null }> = []
) {
  const addresses = [...envelopeTo, ...parsedTo, ...parsedCc]
    .map((entry) => entry.address?.toLowerCase())
    .filter((value): value is string => Boolean(value));

  for (const address of addresses) {
    const match = address.match(/\+project-([^@]+)@/i);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractLatestReply(text: string) {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) {
    return "";
  }

  const markers = [
    /^\s*On .+wrote:\s*$/im,
    /^\s*From:\s.+$/im,
    /^\s*Sent:\s.+$/im,
    /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/im
  ];

  let cutIndex = normalized.length;
  for (const marker of markers) {
    const match = marker.exec(normalized);
    if (match && match.index < cutIndex) {
      cutIndex = match.index;
    }
  }

  const candidate = normalized
    .slice(0, cutIndex)
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n")
    .trim();

  return candidate;
}
