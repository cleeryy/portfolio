import type { Bi } from '../lib/i18n'

/**
 * The closing page: the request, three addresses, and the sheet's colophon.
 *
 * The headline is the ask, not a riddle: an alternance in a SOC or on an
 * offensive team, in Toulouse, for 2026–2027. The invitation carries what he
 * brings — a network he runs, writeups he publishes — and then stops.
 *
 * Nothing here is a form: no field, no required subject, no availability badge
 * with invented dates, no newsletter. The email is the primary action and it is
 * a plain `mailto:` — navigation never depends on a script.
 *
 * The three addresses are supplied by the owner and are the only values in this
 * file that are not prose.
 */

/** Approved by the owner. The primary call to action of the whole sheet. */
export const contactEmail = 'clery.arqueferradou@gmail.com'

/** The public profile he actually uses. No logo wall, no other network. */
export const sourceUrl = 'https://github.com/cleeryy'
export const sourceLabel = 'github.com/cleeryy'

/** Where the writeups are published: the proof behind the training chapter. */
export const blogUrl = 'https://blog.cleeryy.cloud'
export const blogLabel = 'blog.cleeryy.cloud'

export type ContactCopy = {
  title: string
  invite: string
  /** Ledger keys: the address, the code, the writing. */
  mailKey: string
  codeKey: string
  blogKey: string
  /** Colophon. */
  credit: string
  backToTop: string
  /** The legend line under the credit: a scale bar and its reading. */
  scaleNote: string
}

export const contact: Bi<ContactCopy> = {
  en: {
    title: 'An alternance in a SOC, or on the offensive side.',
    invite:
      'Toulouse, 2026–2027. What I bring: a network I run end to end, and writeups I publish. Write plainly — a paragraph is enough, and I answer.',
    mailKey: 'mail',
    codeKey: 'code',
    blogKey: 'writing',
    credit: 'drawn and hosted by cleeryy',
    backToTop: 'Back to the top of the sheet',
    scaleNote: 'not to scale',
  },
  fr: {
    title: 'Une alternance en SOC, ou en sécurité offensive.',
    invite:
      'Toulouse, 2026–2027. Ce que j’apporte\u00a0: un réseau que j’exploite de bout en bout, et des writeups que je publie. Écrivez simplement\u00a0: un paragraphe suffit, et je réponds.',
    mailKey: 'courriel',
    codeKey: 'code',
    blogKey: 'écrits',
    credit: 'dessiné et hébergé par cleeryy',
    backToTop: 'Retour en haut de la feuille',
    scaleNote: 'sans échelle',
  },
}
