// Phase 1.5 #1 — minimal email sender. Two backends, env-gated:
//
//   "webhook"  POST {to, subject, html, text} to MAIL_WEBHOOK_URL.
//              Wire it to Resend / Postmark / a self-hosted SMTP relay.
//              Optional Bearer token via MAIL_WEBHOOK_AUTH.
//   "console"  Default. Logs the rendered mail to stderr; the invite
//              link is still copy-pasteable in the docker logs.
//
// Neither backend introduces a runtime dependency. Phase 2 may swap to
// nodemailer + native SMTP if a deployment can't terminate the
// webhook outbound.

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailSendResult =
  | { backend: 'webhook'; status: number }
  | { backend: 'console' };

export interface MailerEnv {
  webhookUrl?: string;
  webhookAuth?: string;
  fromAddress?: string;
}

export function readMailerEnv(): MailerEnv {
  const env: MailerEnv = {};
  const url = process.env['MAIL_WEBHOOK_URL'];
  if (url) env.webhookUrl = url;
  const auth = process.env['MAIL_WEBHOOK_AUTH'];
  if (auth) env.webhookAuth = auth;
  const from = process.env['MAIL_FROM'];
  if (from) env.fromAddress = from;
  return env;
}

export async function sendEmail(
  input: SendEmailInput,
  envOverride?: MailerEnv,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<EmailSendResult> {
  const env = envOverride ?? readMailerEnv();
  if (env.webhookUrl) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (env.webhookAuth) headers['authorization'] = `Bearer ${env.webhookAuth}`;
    const res = await fetchImpl(env.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: env.fromAddress ?? 'noreply@collaborationtool.example',
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`mail webhook ${res.status}: ${await res.text().catch(() => '')}`);
    }
    return { backend: 'webhook', status: res.status };
  }
  process.stderr.write(
    [
      '[mailer:console] (no MAIL_WEBHOOK_URL set; printing instead of sending)',
      `  to: ${input.to}`,
      `  subject: ${input.subject}`,
      `  text: ${input.text.replace(/\n/g, '\n        ')}`,
      '',
    ].join('\n'),
  );
  return { backend: 'console' };
}
