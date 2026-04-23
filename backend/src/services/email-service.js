// src/services/email-service.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * EmailService
 * - Uses SMTP via environment variables when available
 * - Falls back to JSON transport (logs to console) in development
 */
class EmailService {
  constructor() {
    this.from = process.env.EMAIL_FROM || 'no-reply@greenvision.cloud';
    this.transporter = this.createTransporter();
  }

  createTransporter() {
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_SECURE,
      SMTP_USER,
      SMTP_PASS,
      NODE_ENV
    } = process.env;

    // Use SMTP if host and credentials are present
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      return nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT ? Number(SMTP_PORT) : 587,
        secure: String(SMTP_SECURE || '').toLowerCase() === 'true' || Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
    }

    // Fallback: Dev-friendly JSON transport (no external network calls)
    const jsonTransport = nodemailer.createTransport({ jsonTransport: true });
    if (NODE_ENV !== 'production') {
      console.warn('EmailService: SMTP not configured, using JSON transport (emails will be logged, not sent).');
    }
    return jsonTransport;
  }

  /**
   * Send an email
   * @param {object} params
   * @param {string|string[]} params.to - Recipient(s)
   * @param {string} params.subject - Subject line
   * @param {string} [params.html] - HTML body
   * @param {string} [params.text] - Plain text body
   */
  async sendEmail({ to, subject, html, text, attachments }) {
    if (!to) throw new Error('EmailService.sendEmail: missing `to`');
    const mail = { from: this.from, to, subject, html, text, attachments };
    const info = await this.transporter.sendMail(mail);
    // If using JSON transport, log nicely
    if (this.transporter.options && this.transporter.options.jsonTransport) {
      console.log('📧 Email (JSON transport):', JSON.stringify(info.message, null, 2));
    } else {
      console.log('📧 Email sent:', info.messageId);
    }
    return info;
  }
}

export default new EmailService();
