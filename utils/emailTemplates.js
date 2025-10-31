// utils/emailTemplates.js

const appName = process.env.APP_NAME || 'KwickPay';
const supportEmail = process.env.SUPPORT_EMAIL || 'support@kwickpay.com';
const brandColor = '#0a84ff';
const textColor = '#333333';

export const emailTemplates = {
  otp: ({ name, otp, expires }) => `
    <div style="font-family: Arial, sans-serif; color: ${textColor}; padding: 20px;">
      <h2 style="color: ${brandColor};">${appName} Verification</h2>
      <p>Hello ${name || ''},</p>
      <p>Your verification code is:</p>
      <h1 style="letter-spacing: 4px; font-size: 28px; color: ${brandColor};">${otp}</h1>
      <p>This code will expire in <strong>${expires}</strong> minutes.</p>
      <p>If you didn’t request this, please ignore this email.</p>
      <p>— The ${appName} Team</p>
      <hr />
      <small style="color: #888;">Need help? Contact us at <a href="mailto:${supportEmail}" style="color:${brandColor};">${supportEmail}</a></small>
    </div>
  `,

  passwordReset: ({ name, resetLink }) => `
    <div style="font-family: Arial, sans-serif; color: ${textColor}; padding: 20px;">
      <h2 style="color: ${brandColor};">${appName} Password Reset</h2>
      <p>Hello ${name || ''},</p>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      <a href="${resetLink}" style="display:inline-block; background:${brandColor}; color:#fff; padding:10px 20px; text-decoration:none; border-radius:4px;">Reset Password</a>
      <p>If you didn’t request this, please ignore this email.</p>
      <p>— The ${appName} Team</p>
    </div>
  `,

  pinReset: ({ name, resetLink }) => `
    <div style="font-family: Arial, sans-serif; color: ${textColor}; padding: 20px;">
      <h2 style="color: ${brandColor};">${appName} Transaction PIN Reset</h2>
      <p>Hello ${name || ''},</p>
      <p>You requested to reset your transaction PIN. Click below to continue:</p>
      <a href="${resetLink}" style="display:inline-block; background:${brandColor}; color:#fff; padding:10px 20px; text-decoration:none; border-radius:4px;">Reset PIN</a>
      <p>If you didn’t request this, please ignore this email.</p>
      <p>— The ${appName} Team</p>
    </div>
  `
};