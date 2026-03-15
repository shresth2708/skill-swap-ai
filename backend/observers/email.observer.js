const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailObserver {
  /** @type {import('nodemailer').Transporter|null} */
  #transporter = null;

  /**
   * @param {import('nodemailer').Transporter} [transporter]
   */
  constructor(transporter) {
    if (transporter) this.#transporter = transporter;
  }

  getChannel() {
    return 'email';
  }

  /**
   * @param {import('../interfaces/observer.interface').SwapEvent} event
   */
  async update(event) {
    const { userId, type, title, body, payload } = event;

    const to = payload?.userEmail;
    if (!to) {
      logger.warn('EmailObserver: missing userEmail in payload', { userId, type });
      return;
    }

    const subject = this.#subjectForType(type, payload);
    const html = this.formatTemplate({ title, body, payload });

    const transporter = await this.#getTransporter();
    const info = await transporter.sendMail({
      to,
      from: process.env.MAIL_FROM || 'SkillSwap <no-reply@skillswap.local>',
      subject,
      html,
    });

    if (nodemailer.getTestMessageUrl(info)) {
      logger.info('EmailObserver: ethereal preview url', { url: nodemailer.getTestMessageUrl(info) });
    }
  }

  /**
   * @param {{title: string, body: string, payload?: any}} input
   */
  formatTemplate(input) {
    const safeTitle = String(input.title || 'Notification');
    const safeBody = String(input.body || '');
    const footer = 'SkillSwap AI';

    return `
      <div style="font-family: Arial, sans-serif; background: #f6f7fb; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e9ecf2;">
          <div style="padding: 18px 20px; background: #0f172a; color: #ffffff;">
            <div style="font-size: 14px; opacity: 0.9;">${footer}</div>
            <div style="font-size: 18px; font-weight: 700; margin-top: 6px;">${safeTitle}</div>
          </div>
          <div style="padding: 18px 20px; color: #111827; line-height: 1.5;">
            <div style="font-size: 14px;">${safeBody}</div>
          </div>
          <div style="padding: 14px 20px; background: #f8fafc; color: #64748b; font-size: 12px;">
            You’re receiving this because you enabled email notifications.
          </div>
        </div>
      </div>
    `;
  }

  #subjectForType(type, payload) {
    const name = payload?.actorName || payload?.otherUserName || 'someone';

    switch (type) {
      case 'SWAP_CREATED':
        return `You have a new swap request from ${name}`;
      case 'SWAP_ACCEPTED':
        return 'Your swap request was accepted!';
      case 'SWAP_COMPLETED':
        return `Great job! Leave a review for ${name}`;
      case 'SESSION_SCHEDULED':
        return `Session scheduled for ${payload?.date || ''} ${payload?.time || ''}`.trim();
      case 'REVIEW_RECEIVED':
        return `${name} left you a ${payload?.rating || ''}-star review`.trim();
      default:
        return 'SkillSwap notification';
    }
  }

  async #getTransporter() {
    if (this.#transporter) return this.#transporter;

    const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_PORT;
    if (hasSmtp) {
      this.#transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      return this.#transporter;
    }

    // Dev default: Ethereal SMTP stub
    const testAccount = await nodemailer.createTestAccount();
    this.#transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });

    logger.info('EmailObserver: using Ethereal test account', { user: testAccount.user });
    return this.#transporter;
  }
}

module.exports = EmailObserver;

