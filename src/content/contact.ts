import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   contact.ts — the closing plate
   ----------------------------------------------------------------------------
   One invitation, three addresses, the colophon. No form, no availability badge,
   no invented start date: the ask is an invitation to write, not a claim about
   when he is free.

   The email is supplied by the owner and is the one value in this file that is
   not prose.
   ========================================================================== */

/** Approved by the owner. The primary call to action of the whole sheet. */
export const contactEmail = 'clery.arqueferradou@gmail.com'

/** The public profile he actually uses. No logo wall, no other network. */
export const sourceUrl = 'https://github.com/cleeryy'
export const sourceLabel = 'github.com/cleeryy'

/** Where the writeups are published. */
export const blogUrl = 'https://blog.cleeryy.cloud'
export const blogLabel = 'blog.cleeryy.cloud'

export type ContactCopy = {
  margin: string
  title: string
  invite: string
  mailKey: string
  codeKey: string
  blogKey: string
  credit: string
  backToTop: string
  scaleNote: string
}

export const contact: Bi<ContactCopy> = {
  en: {
    margin: 'the request',
    title: 'An alternance in a SOC, or on the offensive side.',
    invite:
      'That is what I am looking for. I also answer anything else: what the system is, what is broken, or what you want built. A paragraph is enough — I answer.',
    mailKey: 'mail',
    codeKey: 'code',
    blogKey: 'writing',
    credit: 'drawn and hosted by cleeryy',
    backToTop: 'Back to the top of the sheet',
    scaleNote: 'not to scale',
  },
  fr: {
    margin: 'la demande',
    title: fr('Une alternance en SOC, ou en sécurité offensive.'),
    invite: fr('C’est ce que je cherche. Je réponds aussi pour le reste\u00a0: ce qu’est le système, ce qui est cassé, ou ce que vous voulez construire. Un paragraphe suffit — je réponds.'),
    mailKey: 'courriel',
    codeKey: 'code',
    blogKey: 'écrits',
    credit: fr('dessiné et hébergé par cleeryy'),
    backToTop: fr('Retour en haut de la feuille'),
    scaleNote: 'sans échelle',
  },
}
