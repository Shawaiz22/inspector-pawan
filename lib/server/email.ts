import "server-only";
import nodemailer from "nodemailer";

/** Result of attempting to send an access code email. */
export interface SendAccessCodeResult {
  sent: boolean;
  devMode?: boolean;
  error?: string;
}

function buildEmailHtml(code: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #16242B;">
      <div style="border-bottom: 2px solid #1E5C94; padding-bottom: 12px; margin-bottom: 24px;">
        <h2 style="margin: 0; color: #1E5C94;">Inspector Pawan</h2>
        <p style="margin: 4px 0 0; font-size: 14px; color: #52636B;">Every air reading investigated. Every action followed up.</p>
      </div>
      <p style="font-size: 16px; line-height: 1.5;">You requested access to the Inspector Pawan workspace. Use the access code below to unlock the application:</p>
      <div style="background-color: #EEF2F3; border: 1px solid #CBD5D9; border-radius: 8px; padding: 16px 20px; text-align: center; margin: 24px 0;">
        <span style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #1E5C94;">${code}</span>
      </div>
      <p style="font-size: 14px; color: #52636B; line-height: 1.5;">This code provides authorized entry to your investigation session. Keep it secure.</p>
    </div>
  `;
}

/**
 * Sends an access code email to the recipient address.
 * Priority:
 * 1. SMTP (Nodemailer) if SMTP_USER and SMTP_PASS are set (supports Gmail App Passwords without custom domains).
 * 2. Resend API if RESEND_API_KEY is configured.
 * 3. Local Dev Mode fallback: logs code to stdout and returns code preview if enabled.
 */
export async function sendAccessCodeEmail(email: string, code: string): Promise<SendAccessCodeResult> {
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpFrom = process.env.SMTP_FROM?.trim() || `Inspector Pawan <${smtpUser}>`;

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim() || "Inspector Pawan <onboarding@resend.dev>";

  // 1. SMTP via Nodemailer
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: "Your Inspector Pawan Access Code",
        text: `Welcome to Inspector Pawan.\n\nYour access code is:\n${code}\n\nEnter this code on the access screen to unlock your investigation workspace.`,
        html: buildEmailHtml(code),
      });

      return { sent: true };
    } catch (err) {
      return { sent: false, error: err instanceof Error ? err.message : "Failed to deliver email via SMTP" };
    }
  }

  // 2. Resend API fallback
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [email],
          subject: "Your Inspector Pawan Access Code",
          text: `Welcome to Inspector Pawan.\n\nYour access code is:\n${code}\n\nEnter this code on the access screen to unlock your investigation workspace.`,
          html: buildEmailHtml(code),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let cleanMessage = errorText;
        try {
          const parsed = JSON.parse(errorText) as { message?: string };
          if (parsed?.message) {
            cleanMessage = parsed.message;
          }
        } catch {
          // fallback
        }
        return { sent: false, error: cleanMessage };
      }

      return { sent: true };
    } catch (err) {
      return { sent: false, error: err instanceof Error ? err.message : "Failed to deliver email via Resend" };
    }
  }

  // 3. Local Dev Mode fallback
  const allowDevPreview =
    process.env.NODE_ENV !== "production" && process.env.DEV_ACCESS_CODE_PREVIEW !== "false";

  process.stdout.write(`\n[ACCESS CODE] Generated code for ${email}: ${code}\n\n`);
  return { sent: true, devMode: allowDevPreview };
}
