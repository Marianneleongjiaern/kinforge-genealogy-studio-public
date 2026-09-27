export const LEGAL_POLICY_VERSION = "kinforge-privacy-terms-v1";
export const LEGAL_EFFECTIVE_DATE = "September 26, 2026";
export const LEGAL_ACCEPTANCE_STORAGE_KEY = "kinforge-legal-agreement-v1";

export type LegalSection = { title: string; body: string };

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    title: "Who runs KinForge",
    body: "KinForge Genealogy Studio is a product of Dreams of Serene Landscapes. This policy explains what the app and website collect, why it is used, and how users can ask questions."
  },
  {
    title: "What information is collected",
    body: "KinForge may collect account details such as name, email address, password hash, recovery-code hash, session information, beta-interest registration, support requests, permission-proof descriptions, and technical logs needed to run the site. Your family trees, character trees, social-work genograms, history projects, books, collections, media, reports, GEDCOM imports, backups, drive-export records, and app settings may be stored when you use cloud features."
  },
  {
    title: "Local demo and device storage",
    body: "The separate demo can save fictional demo data on the device in browser or app storage. Local-only work stays on the device unless you sign in, sync, export, download, share, or connect a drive."
  },
  {
    title: "How information is used",
    body: "KinForge uses information to provide accounts, sign-in, recovery, private libraries, explicit sharing, beta interest, downloads, support replies, permission review, security checks, backups, exports, update checks, and bug or abuse prevention."
  },
  {
    title: "Sharing and third parties",
    body: "KinForge does not sell user family-tree data. Information may be processed by hosting, storage, email/support, operating-system, browser, Google Drive, OneDrive, or other providers only when needed for features the user uses. Shared libraries are visible only to invited KinForge accounts according to their role."
  },
  {
    title: "Sensitive records",
    body: "Family history, case work, historical research, fiction, roleplay, and RPG worldbuilding can include private, medical, identity, legal, child-care, protection, government, and relationship information. Users are responsible for entering only information they have permission to store and share, marking sensitive records private where appropriate, and reviewing exports before sharing them."
  },
  {
    title: "Support and special access proof",
    body: "Special access or extra permission requests may include proof descriptions or links showing a close or special relationship with Dreams of Serene Landscapes. Proof must be real and not AI-generated. Do not submit identity documents or highly private material through the public form unless support specifically asks for a safer method."
  },
  {
    title: "Retention and deletion",
    body: "Local data can be cleared from the device by the user. Cloud account data, support requests, export records, and logs may be kept as long as needed to provide KinForge, protect the service, handle disputes, keep backups, or meet legal obligations."
  },
  {
    title: "Children",
    body: "KinForge is not intended for children to create accounts without permission from a parent or guardian. Do not enter personal data about children unless you have the right to do so and understand the sensitivity of that information."
  },
  {
    title: "User choices and contact",
    body: "Users may ask support about access, correction, deletion, account recovery, privacy, export permission, or withdrawal of beta interest. Some requests may require verification before KinForge can act."
  }
];

export const TERMS_CONDITIONS_SECTIONS: LegalSection[] = [
  {
    title: "Agreement to use KinForge",
    body: "By using the KinForge app, website, downloads, demo, account system, beta version, exports, or support forms, the user agrees to these Terms & Conditions and the Privacy Policy."
  },
  {
    title: "KinForge account",
    body: "KinForge uses a KinForge email-and-password account, not ChatGPT login. Users must keep passwords and recovery codes private and are responsible for activity from their account."
  },
  {
    title: "Copyright and ownership",
    body: "KinForge Genealogy Studio, its app, website, product idea, design, source, export templates, names, and related materials are owned by Dreams of Serene Landscapes unless another owner is clearly stated. Copyright 2026 Dreams of Serene Landscapes. All rights reserved."
  },
  {
    title: "Export and download credit",
    body: "GEDCOM, Word/RTF-style documents, PDFs, HTML, JSON backups, CSV, app downloads, documents, and any other exported or downloaded KinForge files must keep the KinForge credit and Dreams of Serene Landscapes copyright notice. This applies to free trials, beta access, paid subscriptions, and approved special free access."
  },
  {
    title: "Copyright and special access",
    body: "Paid versions and approved special free access both keep KinForge and Dreams of Serene Landscapes copyright and credit on the app, website, downloads, documents, and exports. Close or special people may request special access or extra written permission through support with real, non-AI proof, such as photos together or other digital or physical records. Approval is not automatic."
  },
  {
    title: "User content",
    body: "Users keep responsibility for the family trees, character trees, social-work genograms, historical research, roleplay campaigns, RPG worlds, media, notes, sources, and reports they add. Users must have permission to enter, upload, share, export, or publish other people's private or copyrighted material."
  },
  {
    title: "Beta and updates",
    body: "Beta features and preview downloads may contain bugs. Users should keep backups, test with copies, and avoid using beta builds as the only copy of important work. Update checks and installers update the app, not the user's library data."
  },
  {
    title: "No genealogy, legal, medical, or financial guarantee",
    body: "KinForge helps organize information but does not guarantee that genealogy conclusions, social-work interpretations, relationship assumptions, historical claims, medical labels, legal records, AI-generated text, roleplay canon, or reports are correct. Users should review evidence and seek qualified advice where needed."
  },
  {
    title: "Acceptable use",
    body: "Users must not misuse KinForge, break security, submit fake proof, impersonate others, upload malware, infringe copyright, harass people, expose private records without permission, or use the service for unlawful purposes. Celebrities or public figures may be included only when clearly needed for fiction, fanfiction, roleplay, RPG, historical-fiction, story, or research context where the public figure is part of that work."
  },
  {
    title: "Changes and support",
    body: "KinForge may update these terms, the privacy policy, app features, beta availability, downloads, and support process. Continued use after an update means the user accepts the updated rules. Questions should go through the support form."
  }
];

export function recordAppLegalAgreement() {
  try {
    localStorage.setItem(LEGAL_ACCEPTANCE_STORAGE_KEY, JSON.stringify({ version: LEGAL_POLICY_VERSION, acceptedAt: new Date().toISOString() }));
  } catch {
    /* Agreement is still enforced by the visible checkboxes for this session. */
  }
}
