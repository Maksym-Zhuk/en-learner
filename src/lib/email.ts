import nodemailer, { Transporter } from 'nodemailer'

let transporter: Transporter | null = null
let initialized = false

/**
 * Lazily build a transporter from SMTP_* env vars.
 * If SMTP_HOST is not configured, returns null so the app keeps working
 * (invitations are still created; we just skip the email).
 */
function getTransporter(): Transporter | null {
  if (initialized) return transporter
  initialized = true

  const host = process.env.SMTP_HOST
  if (!host) return null

  const port = Number(process.env.SMTP_PORT) || 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  })
  return transporter
}

export interface InviteEmailOptions {
  to: string
  groupName: string
  emoji: string
  inviteUrl: string
  role: string
}

/** Returns true if an email was actually dispatched, false if mailing is not configured or failed. */
export async function sendInviteEmail(opts: InviteEmailOptions): Promise<boolean> {
  const t = getTransporter()
  if (!t) return false

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@en-learner.app'
  const roleLabel = opts.role === 'editor' ? 'редагування' : 'перегляд'

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#0F1117;color:#F1F5F9;padding:32px;border-radius:16px;max-width:480px;margin:auto">
      <div style="font-size:40px;text-align:center">${opts.emoji}</div>
      <h2 style="text-align:center;margin:8px 0 4px">Запрошення до групи</h2>
      <p style="text-align:center;color:#94A3B8;margin:0 0 20px">
        Вас запрошено приєднатися до групи <strong style="color:#F1F5F9">«${opts.groupName}»</strong>
        з роллю <strong>${roleLabel}</strong> у застосунку en-learner.
      </p>
      <div style="text-align:center">
        <a href="${opts.inviteUrl}"
           style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;
                  padding:12px 24px;border-radius:10px;font-weight:600">
          Прийняти запрошення
        </a>
      </div>
      <p style="color:#475569;font-size:12px;text-align:center;margin-top:20px;word-break:break-all">
        Або перейдіть за посиланням: ${opts.inviteUrl}
      </p>
    </div>`

  try {
    await t.sendMail({
      from,
      to: opts.to,
      subject: `Запрошення до групи «${opts.groupName}» — en-learner`,
      text: `Вас запрошено до групи "${opts.groupName}" (роль: ${roleLabel}). Приєднайтесь: ${opts.inviteUrl}`,
      html,
    })
    return true
  } catch (error) {
    console.error('sendInviteEmail error:', error)
    return false
  }
}
