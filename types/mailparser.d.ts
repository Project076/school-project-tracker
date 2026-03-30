declare module "mailparser" {
  export function simpleParser(source: Buffer): Promise<{
    messageId?: string;
    subject?: string;
    text?: string;
    date?: Date;
    from?: {
      value?: Array<{
        name?: string;
        address?: string;
      }>;
    };
    to?: {
      value?: Array<{
        name?: string;
        address?: string;
      }>;
    };
    cc?: {
      value?: Array<{
        name?: string;
        address?: string;
      }>;
    };
  }>;
}
