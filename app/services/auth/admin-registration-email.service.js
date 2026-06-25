/**
 * @fileoverview Email sender for admin registration, updates and deletion
 */

const nodemailer = require('nodemailer');
const runtimeConfig = require('../../config/runtime-config');

function getSmtpConfig() {
    const host = runtimeConfig.get('SMTP_HOST');
    const port = runtimeConfig.get('SMTP_PORT');
    const secure = runtimeConfig.get('SMTP_SECURE') === 'true';
    const user = runtimeConfig.get('SMTP_USER');
    const pass = runtimeConfig.get('SMTP_PASS');
    const from = runtimeConfig.get('SMTP_FROM') || `"XIRO!" <${user}>`;

    if (!host || !user || !pass) {
        const err = new Error('SMTP no configurado');
        err.code = 'SMTP_NOT_CONFIGURED';
        throw err;
    }

    return {
        host,
        port,
        secure,
        auth: { user, pass },
        from
    };
}

function getBaseUrl() {
    // Attempt to get from env or runtime, fallback to https://xiro.pro
    return String(process.env.PUBLIC_BASE_URL || runtimeConfig.get('SERVER_HOST') || 'https://xiro.pro').trim().replace(/\/$/, '');
}

function buildHtmlTemplate(innerHtml) {
    const baseUrl = getBaseUrl();
    const year = new Date().getFullYear();
    
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 40px 20px; text-align: center; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background-color: #0f172a; padding: 30px 20px; border-bottom: 2px solid #f9b518; }
        .logo { max-width: 150px; }
        .mascot-container { margin-top: -40px; margin-bottom: 20px; text-align: center; }
        .mascot { width: 100px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); }
        .content { padding: 30px 40px; text-align: left; font-size: 16px; line-height: 1.6; color: #cbd5e1; }
        .content p { margin: 15px 0; }
        .content strong { color: #f8fafc; }
        .btn-container { text-align: center; margin: 30px 0; }
        .button { display: inline-block; background-color: #f9b518; color: #0f172a !important; font-weight: bold; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; box-shadow: 0 4px 6px rgba(249, 181, 24, 0.3); }
        .button-danger { background-color: #ef4444; color: #ffffff !important; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3); }
        .footer { padding: 20px; font-size: 13px; color: #64748b; background-color: #0f172a; text-align: center; }
        .warning-text { color: #ef4444; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img class="logo" src="${baseUrl}/images/logo.svg" alt="XIRO!">
        </div>
        <div class="content">
            <div class="mascot-container">
                <img class="mascot" src="${baseUrl}/images/chamaleon/detective.svg" alt="Xiro Mascot">
            </div>
            ${innerHtml}
        </div>
        <div class="footer">
            © ${year} XIRO! - Plataforma de Quiz
        </div>
    </div>
</body>
</html>`;
}

async function sendAdminRegistrationConfirmationEmail({ to, username, confirmationUrl }) {
    const smtp = getSmtpConfig();
    const transporter = nodemailer.createTransport(smtp);

    const subject = 'Confirma tu cuenta de XIRO!';
    const text = [
        `Hola ${username},`,
        '',
        'Hemos recibido una solicitud para crear tu cuenta en XIRO!.',
        'Confirma el registro haciendo clic en este enlace:',
        confirmationUrl,
        '',
        'Este enlace caduca en 24 horas.',
        'Si no has solicitado esta cuenta, puedes ignorar este correo.'
    ].join('\n');

    const htmlContent = `
        <p>Hola <strong>${username}</strong>,</p>
        <p>Hemos recibido una solicitud para crear tu cuenta en <strong>XIRO!</strong>.</p>
        <div class="btn-container">
            <a href="${confirmationUrl}" class="button">Confirmar cuenta</a>
        </div>
        <p style="font-size: 14px; color: #94a3b8;">Este enlace caduca en 24 horas.</p>
        <p style="font-size: 14px; color: #94a3b8;">Si no has solicitado esta cuenta, puedes ignorar este correo.</p>
    `;

    await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        text,
        html: buildHtmlTemplate(htmlContent)
    });
}

async function sendAdminEmailChangeConfirmationEmail({ to, username, confirmationUrl }) {
    const smtp = getSmtpConfig();
    const transporter = nodemailer.createTransport(smtp);

    const subject = 'Confirma el cambio de correo en XIRO!';
    const text = [
        `Hola ${username},`,
        '',
        'Hemos recibido una solicitud para cambiar el correo de tu cuenta.',
        'Confirma el cambio con este enlace:',
        confirmationUrl,
        '',
        'Este enlace caduca en 24 horas.',
        'Si no has solicitado este cambio, ignora este mensaje.'
    ].join('\n');

    const htmlContent = `
        <p>Hola <strong>${username}</strong>,</p>
        <p>Hemos recibido una solicitud para cambiar el correo de tu cuenta a esta dirección.</p>
        <div class="btn-container">
            <a href="${confirmationUrl}" class="button">Confirmar cambio de correo</a>
        </div>
        <p style="font-size: 14px; color: #94a3b8;">Este enlace caduca en 24 horas.</p>
        <p style="font-size: 14px; color: #94a3b8;">Si no has solicitado este cambio, ignora este mensaje.</p>
    `;

    await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        text,
        html: buildHtmlTemplate(htmlContent)
    });
}

async function sendAdminEmailChangeAlertEmail({ to, username, newEmail }) {
    const smtp = getSmtpConfig();
    const transporter = nodemailer.createTransport(smtp);

    const subject = 'Aviso de solicitud de cambio de correo en XIRO!';
    const text = [
        `Hola ${username},`,
        '',
        `Se ha solicitado cambiar el correo de tu cuenta a: ${newEmail}`,
        'Todavía no se ha aplicado ningún cambio.',
        'Si no has sido tú, revisa tu contraseña cuanto antes.'
    ].join('\n');

    const htmlContent = `
        <p>Hola <strong>${username}</strong>,</p>
        <p>Se ha solicitado cambiar el correo de tu cuenta a: <strong>${newEmail}</strong>.</p>
        <p>Todavía no se ha aplicado ningún cambio.</p>
        <p class="warning-text">Si no has sido tú, revisa tu contraseña cuanto antes o contacta con soporte.</p>
    `;

    await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        text,
        html: buildHtmlTemplate(htmlContent)
    });
}

async function sendAdminDeletionConfirmationEmail({ to, username, confirmationUrl }) {
    const smtp = getSmtpConfig();
    const transporter = nodemailer.createTransport(smtp);

    const subject = 'Confirma la eliminación de tu cuenta en XIRO!';
    const text = [
        `Hola ${username},`,
        '',
        'Hemos recibido una solicitud para eliminar permanentemente tu cuenta en XIRO!.',
        'Al confirmar, perderás acceso a todos tus juegos y configuraciones de forma irreversible.',
        'Confirma la eliminación haciendo clic en este enlace:',
        confirmationUrl,
        '',
        'Este enlace caduca en 24 horas.',
        'Si no has solicitado eliminar tu cuenta, ignora este mensaje.'
    ].join('\n');

    const htmlContent = `
        <p>Hola <strong>${username}</strong>,</p>
        <p>Hemos recibido una solicitud para <strong class="warning-text">eliminar permanentemente</strong> tu cuenta en XIRO!.</p>
        <p>Al confirmar, perderás acceso a todos tus juegos y configuraciones de forma irreversible.</p>
        <div class="btn-container">
            <a href="${confirmationUrl}" class="button button-danger">Sí, eliminar mi cuenta definitivamente</a>
        </div>
        <p style="font-size: 14px; color: #94a3b8;">Este enlace caduca en 24 horas.</p>
        <p style="font-size: 14px; color: #94a3b8;">Si no has solicitado eliminar tu cuenta, ignora este mensaje y cambia tu contraseña.</p>
    `;

    await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        text,
        html: buildHtmlTemplate(htmlContent)
    });
}

module.exports = {
    sendAdminRegistrationConfirmationEmail,
    sendAdminEmailChangeConfirmationEmail,
    sendAdminEmailChangeAlertEmail,
    sendAdminDeletionConfirmationEmail
};
