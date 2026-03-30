declare module "imapflow" {
  export class ImapFlow {
    constructor(options: unknown);
    connect(): Promise<void>;
    logout(): Promise<void>;
    getMailboxLock(mailbox: string): Promise<{ release(): void }>;
    fetch(range: string, query: unknown): AsyncIterable<{
      uid: number;
      envelope?: {
        to?: Array<{ address?: string | null }>;
      };
      source: Buffer;
      internalDate: Date;
    }>;
  }
}
