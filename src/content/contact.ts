import type { Bi } from '../lib/i18n'

/**
 * The closing page: one invitation, one address, and the sheet's colophon.
 *
 * Nothing here is a form: no field, no required subject, no fake availability
 * badge, no newsletter. The email is the only call to action that matters and
 * it is a plain `mailto:` — navigation never depends on a script.
 *
 * The address and the profile URL are supplied by the owner and are the only
 * two values in this file that are not prose.
 */

/** Approved by the owner. The primary call to action of the whole sheet. */
export const contactEmail = 'clery.arqueferradou@gmail.com'

/** The one public profile he actually uses. No logo wall, no other network. */
export const sourceUrl = 'https://github.com/cleeryy'
export const sourceLabel = 'github.com/cleeryy'

export type ContactCopy = {
  title: string
  invite: string
  /** Ledger keys: the address, then the code. */
  mailKey: string
  codeKey: string
  /** Colophon. */
  credit: string
  backToTop: string
  /** The legend line under the credit: a scale bar and its reading. */
  scaleNote: string
}

export const contact: Bi<ContactCopy> = {
  en: {
    title: 'Something to break, or something to keep running?',
    invite:
      'Security work, infrastructure, a CTF team short of one pair of hands. Write plainly — a paragraph is enough, and I answer.',
    mailKey: 'mail',
    codeKey: 'code',
    credit: 'drawn and hosted by cleeryy',
    backToTop: 'Back to the top of the sheet',
    scaleNote: 'not to scale',
  },
  fr: {
    title: 'Quelque chose à casser, ou quelque chose à faire tourner\u00a0?',
    invite:
      'Du travail de sécurité, de l’infrastructure, une équipe CTF à qui il manque une paire de mains. Écrivez simplement\u00a0: un paragraphe suffit, et je réponds.',
    mailKey: 'courriel',
    codeKey: 'code',
    credit: 'dessiné et hébergé par cleeryy',
    backToTop: 'Retour en haut de la feuille',
    scaleNote: 'sans échelle',
  },
}
