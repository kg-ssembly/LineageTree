"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineageTreeEmailTemplates = void 0;
exports.buildInviteEmailTemplate = buildInviteEmailTemplate;
exports.buildPasswordResetEmailTemplate = buildPasswordResetEmailTemplate;
exports.buildAccountCreatedEmailTemplate = buildAccountCreatedEmailTemplate;
exports.buildNotificationEmailTemplate = buildNotificationEmailTemplate;
const defaultBrand = {
    appName: 'Lineage Tree',
    supportEmail: 'support@lineagetree.app',
    primaryColor: '#285943',
    accentColor: '#D7B66F',
    logoUrl: '',
};
function mergeBrand(data) {
    return {
        ...defaultBrand,
        ...data,
    };
}
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
function nl2br(value) {
    return escapeHtml(value).replaceAll('\n', '<br />');
}
function toPlainText(value) {
    return value.replaceAll(/\s+/g, ' ').trim();
}
function buildButton(label, url, color) {
    return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="border-radius:999px;background:${color};">
          <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:700;line-height:20px;color:#F8F4EA;text-decoration:none;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}
function buildMetadataRows(metadata) {
    if (!metadata?.length) {
        return '';
    }
    return metadata.map(({ label, value }) => `
    <tr>
      <td style="padding:0 0 8px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#6B6B6B;width:140px;vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:0 0 8px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#1F2933;vertical-align:top;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `).join('');
}
function buildEmailLayout(options) {
    const { brand, eyebrow, title, intro, bodyHtml, actionHtml, footerNote, preheader } = options;
    const safePreheader = escapeHtml(preheader);
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F4EFE6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safePreheader}
    </div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:linear-gradient(180deg,#F4EFE6 0%,#EEE5D4 100%);">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;">
            <tr>
              <td style="padding:0 0 16px 0;text-align:center;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:0.4px;color:${brand.primaryColor};">
                  ${brand.logoUrl ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.appName)}" style="max-height:44px;" />` : escapeHtml(brand.appName)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#FFFDF8;border:1px solid #E8DCC8;border-radius:28px;padding:40px 32px;box-shadow:0 18px 40px rgba(31,41,51,0.08);">
                <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${brand.accentColor};margin-bottom:14px;">
                  ${escapeHtml(eyebrow)}
                </div>
                <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:40px;color:#1F2933;">
                  ${escapeHtml(title)}
                </h1>
                <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:16px;line-height:26px;color:#52606D;">
                  ${escapeHtml(intro)}
                </p>
                <div style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#334E68;">
                  ${bodyHtml}
                </div>
                ${actionHtml ? `<div style="margin:0 0 24px;">${actionHtml}</div>` : ''}
                <div style="border-top:1px solid #EFE3CF;padding-top:20px;">
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:22px;color:#7B8794;">
                    ${escapeHtml(footerNote ?? `Need help? Contact ${brand.supportEmail}.`)}
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 12px 0;text-align:center;font-family:Arial,sans-serif;font-size:12px;line-height:20px;color:#7B8794;">
                ${escapeHtml(brand.appName)} helps families preserve stories, names, and connections across generations.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
function buildInviteEmailTemplate(data) {
    const brand = mergeBrand(data);
    const recipientLabel = data.recipientName?.trim() || 'there';
    const subject = `${data.inviterName} invited you to join ${data.treeName} on ${brand.appName}`;
    const preheader = `Join ${data.treeName} as a ${data.roleLabel} and start collaborating with your family.`;
    const html = buildEmailLayout({
        brand,
        eyebrow: 'Family Invitation',
        title: 'You have been invited to a family tree',
        intro: `Hello ${recipientLabel}, ${data.inviterName} has invited you to join "${data.treeName}" on ${brand.appName}.`,
        bodyHtml: `
      <p style="margin:0 0 16px;">This invitation gives you <strong>${escapeHtml(data.roleLabel)}</strong> access so you can help preserve family history, add stories, and keep your shared lineage up to date.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#F8F4EA;border-radius:18px;padding:18px 20px;margin:0 0 18px;">
        ${buildMetadataRows([
            { label: 'Family tree', value: data.treeName },
            { label: 'Invited by', value: data.inviterName },
            { label: 'Access level', value: data.roleLabel },
            ...(data.expiresIn ? [{ label: 'Expires', value: data.expiresIn }] : []),
        ])}
      </table>
      ${data.message?.trim() ? `<p style="margin:0 0 16px;"><strong>Personal note:</strong><br />${nl2br(data.message.trim())}</p>` : ''}
      <p style="margin:0;">If you were expecting this invitation, use the button below to accept it and continue in ${escapeHtml(brand.appName)}.</p>
    `,
        actionHtml: buildButton('Accept Invitation', data.inviteUrl, brand.primaryColor),
        footerNote: `If you did not expect this invitation, you can safely ignore this email or contact ${brand.supportEmail}.`,
        preheader,
    });
    const text = [
        `Hello ${recipientLabel},`,
        '',
        `${data.inviterName} invited you to join "${data.treeName}" on ${brand.appName}.`,
        `Access level: ${data.roleLabel}`,
        data.expiresIn ? `Invitation expires: ${data.expiresIn}` : '',
        data.message?.trim() ? `Personal note: ${toPlainText(data.message)}` : '',
        '',
        `Accept invitation: ${data.inviteUrl}`,
        '',
        `If you did not expect this invitation, ignore this email or contact ${brand.supportEmail}.`,
    ].filter(Boolean).join('\n');
    return { subject, preheader, html, text };
}
function buildPasswordResetEmailTemplate(data) {
    const brand = mergeBrand(data);
    const recipientLabel = data.recipientName?.trim() || 'there';
    const subject = `Reset your ${brand.appName} password`;
    const preheader = `Use this secure link to reset your ${brand.appName} password.`;
    const html = buildEmailLayout({
        brand,
        eyebrow: 'Account Security',
        title: 'Reset your password',
        intro: `Hello ${recipientLabel}, we received a request to reset your ${brand.appName} password.`,
        bodyHtml: `
      <p style="margin:0 0 16px;">Use the secure button below to choose a new password and get back to your family tree.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#F8F4EA;border-radius:18px;padding:18px 20px;margin:0 0 18px;">
        ${buildMetadataRows(data.expiresIn ? [{ label: 'Link expires', value: data.expiresIn }] : [])}
      </table>
      <p style="margin:0;">If you did not request this, you can ignore this email. Your password will stay unchanged.</p>
    `,
        actionHtml: buildButton('Reset Password', data.resetUrl, brand.primaryColor),
        footerNote: `If the button does not work, copy and paste this link into your browser: ${data.resetUrl}`,
        preheader,
    });
    const text = [
        `Hello ${recipientLabel},`,
        '',
        `We received a request to reset your ${brand.appName} password.`,
        data.expiresIn ? `This link expires in ${data.expiresIn}.` : '',
        `Reset password: ${data.resetUrl}`,
        '',
        'If you did not request this, ignore this email.',
    ].filter(Boolean).join('\n');
    return { subject, preheader, html, text };
}
function buildAccountCreatedEmailTemplate(data) {
    const brand = mergeBrand(data);
    const recipientLabel = data.recipientName?.trim() || 'there';
    const subject = `Your ${brand.appName} account is ready`;
    const preheader = `Your new ${brand.appName} account has been created and is ready to use.`;
    const html = buildEmailLayout({
        brand,
        eyebrow: 'Welcome',
        title: 'Your account is ready',
        intro: `Hello ${recipientLabel}, your ${brand.appName} account has been created successfully.`,
        bodyHtml: `
      <p style="margin:0 0 16px;">You can now sign in and start building, reviewing, or managing family trees.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#F8F4EA;border-radius:18px;padding:18px 20px;margin:0 0 18px;">
        ${buildMetadataRows([
            ...(data.createdByName ? [{ label: 'Created by', value: data.createdByName }] : []),
            ...(data.temporaryPassword ? [{ label: 'Temporary password', value: data.temporaryPassword }] : []),
        ])}
      </table>
      <p style="margin:0;">For the best experience, sign in soon and update your password if a temporary one was issued.</p>
    `,
        actionHtml: buildButton('Sign In', data.loginUrl, brand.primaryColor),
        footerNote: `If you were not expecting this account, contact ${brand.supportEmail} immediately.`,
        preheader,
    });
    const text = [
        `Hello ${recipientLabel},`,
        '',
        `Your ${brand.appName} account has been created successfully.`,
        data.createdByName ? `Created by: ${data.createdByName}` : '',
        data.temporaryPassword ? `Temporary password: ${data.temporaryPassword}` : '',
        `Sign in: ${data.loginUrl}`,
        '',
        `If you were not expecting this account, contact ${brand.supportEmail}.`,
    ].filter(Boolean).join('\n');
    return { subject, preheader, html, text };
}
function buildNotificationEmailTemplate(data) {
    const brand = mergeBrand(data);
    const recipientLabel = data.recipientName?.trim() || 'there';
    const subject = `${brand.appName}: ${data.title}`;
    const preheader = data.summary;
    const html = buildEmailLayout({
        brand,
        eyebrow: 'Notification',
        title: data.title,
        intro: `Hello ${recipientLabel}, here is an update from ${brand.appName}.`,
        bodyHtml: `
      <p style="margin:0 0 16px;">${escapeHtml(data.summary)}</p>
      ${data.metadata?.length ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#F8F4EA;border-radius:18px;padding:18px 20px;margin:0 0 18px;">
          ${buildMetadataRows(data.metadata)}
        </table>
      ` : ''}
      <p style="margin:0;">Open ${escapeHtml(brand.appName)} to review the details and decide what to do next.</p>
    `,
        actionHtml: data.actionUrl && data.actionLabel ? buildButton(data.actionLabel, data.actionUrl, brand.primaryColor) : undefined,
        preheader,
    });
    const text = [
        `Hello ${recipientLabel},`,
        '',
        `${data.title}`,
        data.summary,
        ...(data.metadata?.map((entry) => `${entry.label}: ${entry.value}`) ?? []),
        data.actionUrl ? '' : '',
        data.actionUrl && data.actionLabel ? `${data.actionLabel}: ${data.actionUrl}` : '',
    ].filter(Boolean).join('\n');
    return { subject, preheader, html, text };
}
exports.lineageTreeEmailTemplates = {
    invite: buildInviteEmailTemplate,
    passwordReset: buildPasswordResetEmailTemplate,
    accountCreated: buildAccountCreatedEmailTemplate,
    notification: buildNotificationEmailTemplate,
};
