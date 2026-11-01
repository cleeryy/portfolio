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
    title: 'Tell me what you are building.',
    invite:
      'I answer email. A paragraph is enough: what the system is, what is broken, or what you want built. An internship, an apprenticeship, a machine that will not boot — same address.',
    mailKey: 'mail',
    codeKey: 'code',
    blogKey: 'writing',
    credit: 'drawn and hosted by cleeryy',
    backToTop: 'Back to the top of the sheet',
    scaleNote: 'not to scale',
  },
  fr: {
    margin: 'la demande',
    title: fr('Dites-moi ce que vous construisez.'),
    invite: fr('Je réponds aux courriels. Un paragraphe suffit\u00a0: ce qu’est le système, ce qui est cassé, ou ce que vous voulez construire. Un stage, une alternance, une machine qui ne démarre pas — même adresse.'),
    mailKey: 'courriel',
    codeKey: 'code',
    blogKey: 'écrits',
    credit: fr('dessiné et hébergé par cleeryy'),
    backToTop: fr('Retour en haut de la feuille'),
    scaleNote: 'sans échelle',
  },
}
