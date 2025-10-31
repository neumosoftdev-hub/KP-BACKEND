import Brevo from '@getbrevo/brevo';
import { emailTemplates } from './emailTemplates.js';

const apiKey = process.env.BREVO_API_KEY;
const senderName = process.env.BREVO_FROM_NAME || process.env.APP_NAME || 'App';
const senderEmail = process.env.BREVO_FROM_EMAIL || process.env.EMAIL_USER;

// Initialize the Brevo API client
const brevoClient = new Brevo.TransactionalEmailsApi();
brevoClient.authentications['apiKey'].apiKey = apiKey;

// Generic email sender
export const sendEmail = async (to, subject, html, text = '') => {
  try {
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.sender = { name: senderName, email: senderEmail };
    sendSmtpEmail.to = [{ email: to }];

    const response = await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Email sent:', response?.messageId || response);
    return response;
  } catch (error) {
    console.error('❌ Brevo email error:', error.response?.body || error.message);
    throw error;
  }
};

// OTP Email
export const sendOTPEmail = async (to, otp, { expiresInMinutes = 10, name = '' } = {}) => {
  const subject = `${process.env.APP_NAME || 'App'} Verification Code`;
  const html = emailTemplates.otp({ name, otp, expires: expiresInMinutes });
  const text = `Your verification code is ${otp}. It expires in ${expiresInMinutes} minutes.`;

  return sendEmail(to, subject, html, text);
};

// Password Reset
export const sendPasswordResetEmail = async (to, name, resetLink) => {
  const subject = `${process.env.APP_NAME || 'App'} Password Reset`;
  const html = emailTemplates.passwordReset({ name, resetLink });
  const text = `Use this link to reset your password: ${resetLink}`;

  return sendEmail(to, subject, html, text);
};

// PIN Reset
export const sendPinResetEmail = async (to, name, resetLink) => {
  const subject = `${process.env.APP_NAME || 'App'} PIN Reset`;
  const html = emailTemplates.pinReset({ name, resetLink });
  const text = `Use this link to reset your PIN: ${resetLink}`;

  return sendEmail(to, subject, html, text);
};
