import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

export const sendEmail = async (opts: EmailOptions) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP not configured, skipping sending email to", opts.to);
    return;
  }

  const from = process.env.EMAIL_FROM || `no-reply@${process.env.DEFAULT_TENANT_SLUG || "localhost"}`;

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
};

export default sendEmail;
