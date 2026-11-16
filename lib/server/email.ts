import "server-only";

/** Result of attempting to send an access code email. */
export interface SendAccessCodeResult {
  sent: boolean;
  devMode?: boolean;
  error?: string;
}

/**
 * Sends an access code to the recipient email address using the Resend API.
 * When RESEND_API_KEY is not configured (e.g. in development), logs the code to stdout.
 */
export async function sendAccessCodeEmail(email: string, code: string): Promise<SendAccessCodeResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "Inspector Pawan <onboarding@resend.dev>";

  if (!apiKey) {
    process.stdout.write(`\n[ACCESS CODE] Generated code for ${email}: ${code}\n\n`);
    return { sent: true, devMode: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Your Inspector Pawan Access Code",
        text: `Welcome to Inspector Pawan.\n\nYour access code is:\n${code}\n\nEnter this code on the access screen to unlock your investigation workspace.`,
        html: `
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
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { sent: false, error: `Resend error (${response.status}): ${errorText}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Failed to deliver email" };
  }
}
