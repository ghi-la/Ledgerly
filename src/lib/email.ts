import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Resend's free tier (100 emails/day, no card required) needs a verified
 * sending domain to reach arbitrary recipients; until EMAIL_FROM points at
 * one, `onboarding@resend.dev` only delivers to the account's own inbox. In
 * dev, with no RESEND_API_KEY set at all, the link is logged instead so the
 * flow is still testable end to end.
 */
export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set. Verification link for ${to}:\n${verifyUrl}`);
    return;
  }

  const from = process.env.EMAIL_FROM || 'Ledgerly <onboarding@resend.dev>';
  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Confirm your Ledgerly account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2E7D6F;">Welcome to Ledgerly${name ? `, ${name}` : ''}</h2>
        <p>Confirm your email address to finish creating your account.</p>
        <p>
          <a href="${verifyUrl}" style="display: inline-block; background: #2E7D6F; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
            Confirm email
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">Or paste this link into your browser: ${verifyUrl}</p>
        <p style="color: #666; font-size: 13px;">This link expires in 24 hours. If you didn't create a Ledgerly account, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error('[email] Failed to send verification email:', error);
    throw new Error('Could not send the verification email. Try again shortly.');
  }
}
