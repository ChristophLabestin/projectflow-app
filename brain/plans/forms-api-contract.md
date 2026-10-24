# Forms — API-Vertrag (Paket 2)

Stand 2026-10-24 · Konzept: [forms-concept.md](./forms-concept.md) · Logik: `web/utils/formsLogic.ts` (= `functions/src/forms-logic.ts`) ·
Doc-Typen: `web/types/forms.ts`. Region `europe-west3`, Callables mit `runWith(FAST_START)`, alle Namen in `FUNCTION_MODULES`.
Fehler von Callables: `HttpsError(code, <message>)`, die Message ist ein Code aus der Liste unten.

## Callables (angemeldet)
| Name | Eingabe | Ergebnis | Prüfung |
|---|---|---|---|
| `createForm` | `{ tenantId, title, description?, draft?, audience?, language? }` | `{ formId }` | `canCreateForms`; Defaults §Defaults; `draft` wird normalisiert |
| `saveFormDraft` | `{ tenantId, formId, patch }` — `patch` ⊆ `title, description, draft, audience, anonymous, allowGuests, language, layout, theme, settings, embed, actions` | `{ updatedAt }` | `canEditForm`; Schema wird normalisiert (Limits, Trim), **nicht** auf Vollständigkeit geprüft |
| `publishForm` | `{ tenantId, formId }` | `{ version, shareToken, status }` | `canEditForm`; `validateFormSchema(draft)` leer, sonst `form-invalid` + `issues`; Plan (`plan-form-limit`, `plan-form-feature`); Zielgruppe `public` braucht `isTenantLegalComplete(tenant.legal)` → sonst `form-legal-missing`; schreibt `versions/{n}`, `public_forms/{token}`, `status:'published'` |
| `setFormStatus` | `{ tenantId, formId, status: 'published'\|'paused'\|'closed' }` | `{ status }` | `published` nur mit `publishedVersion` (sonst `form-not-published`), Plan-Limit beim Reaktivieren; spiegelt `status` in `public_forms` |
| `regenerateFormLink` | `{ tenantId, formId }` | `{ shareToken }` | alter Index gelöscht |
| `duplicateForm` | `{ tenantId, formId }` | `{ formId }` | Kopie als `draft`, Titel „… (Kopie/Copy)“, Eigentümer = Aufrufer, keine Antworten |
| `deleteForm` | `{ tenantId, formId }` | `{ ok }` | Eigentümer oder `canManageAllForms`; löscht Unter-Collections, Index, Assets, Antwort-Dateien + `files`-Records |
| `setFormEditors` | `{ tenantId, formId, editorIds, ownerId? }` | `{ ok }` | nur volle Mitglieder; `ownerId` ändern nur Eigentümer/`canManageAllForms` |
| `createFormAssetUpload` | `{ tenantId, formId, kind: 'logo'\|'cover'\|'background', contentType, size }` | `{ uploadUrl, path, publicUrl, headers }` | `canEditForm`; png/jpeg/webp/gif, ≤ 5 MB; Pfad `public/forms/{t}/{formId}/assets/{kind}-{rand}.{ext}` (öffentlich lesbar) |
| `getFormForMember` | `{ tenantId, formId }` oder `{ token }` | wie `getPublicForm.form` + `session` | Mitglied, `canFillWorkspaceForm`, Status `published` |
| `submitFormAsMember` | `{ tenantId, formId, session, answers, durationMs, source: 'app'\|'ios' }` | `{ responseId, confirmation }` | wie Public-Submit ohne Honeypot/IP; `onePerMember` → `form-already-answered`; `respondent.uid` außer bei `anonymous` |

## Öffentlich (HTTP `onRequest`, CORS wie `initiative-feedback`)
Client ruft `https://europe-west3-<project>.cloudfunctions.net/<name>` bzw. den Functions-Emulator.

**`getPublicForm`** `GET ?token=` →
`200 { status:'open', form: PublicForm, session }` · `200 { status:'paused'|'closed'|'limit', title, theme, language, legal }` ·
`200 { status:'workspace', tenantId, formId, title, language }` (Workspace-Formular: Client meldet an und nutzt `getFormForMember`) · `404 { error:'form-not-found' }`.
```
PublicForm = { title, description, language, layout, schema: FormSchema (veröffentlichte Version), version,
  theme: FormTheme (Asset-Pfade als absolute URLs aufgelöst), settings: { confirmation, consent, hideBranding },
  legal: { controllerName, privacyPolicyUrl, imprintUrl }, uploadsEnabled: boolean }
```
`session` = signiertes Formular-Session-Token `base64url(json{tok,iat,n}).hmac` (HMAC-SHA256, Server-Secret), gültig 24 h.

**`createPublicFormUpload`** `POST { token, session, fieldId, name, size, contentType }` →
`200 { fileId, uploadUrl, headers }` (Signed PUT, 15 min). Prüft Session, Feld ist `fileUpload` der veröffentlichten
Version, `fileKindAllows`, `maxFileBytes`, Plan `uploads`, Workspace-Speicherquota (`getWorkspaceFileUsage` + `quotaAllows`),
Rate-Limit 20/h pro Token+IP. Pending-Doc `tenants/{t}/form_uploads/{fileId}` (`expireAt` +24 h, TTL), Objekt
`tenants/{t}/files/forms/{formId}/{fileId}/{name}` im Default-Bucket.

**`submitPublicForm`** `POST { token, session, answers, website, durationMs, source: 'link'|'embed' }` →
`200 { ok: true, confirmation: { text?, redirectUrl? } }` · `400 { error:'form-invalid-answers', fieldErrors: FormAnswerError[] }` ·
`409 { error: 'form-closed'|'form-limit'|'plan-form-responses' }` · `429 { error:'rate-limited' }` · `400 { error:'form-session-invalid' }`.
Prüfkette (Konzept §8): Größe ≤ 256 kB → Index/Status/`closesAt`/`maxResponses`/Plan-Antworten → Session (≥ 3 s, ≤ 24 h) →
Honeypot `website` (gefüllt ⇒ stilles `200`, nichts gespeichert) → Rate-Limits (Token+IP-Hash 5/min, 30/h; Formular 600/h;
Tenant 3.000/h; IP-Hash = HMAC(Tagessalz, IP)) → `validateSubmission` → Uploads gegen Pending-Docs derselben Session/Feld,
Objekt existiert, Größe passt → `files/{fileId}`-Record (`module:'forms'`, `listed:false`) → Spam-Heuristik (> 3 Links, gleicher
Inhalts-Hash im Formular binnen 10 min ⇒ `status:'spam'`) → Antwort-Doc + `forms_usage/{yyyy-mm}.responses` + `counts` (Transaktion).

## Antwort-Doc (`tenants/{t}/forms/{f}/responses/{rid}`)
`{ version, submittedAt, status, answers, respondent: { uid?, email? }, meta: { source, locale?, durationMs }, expireAt? }` —
`respondent.email` = Antwort des Felds mit `isRespondentEmail`; `expireAt` = `responseExpiry(submittedAt, settings.retentionMonths)`.

## Defaults neuer Formulare
`status:'draft'`, `audience:'public'`, `anonymous:false`, `layout:'classic'`, `language` = Sprache des Erstellers (`de`/`en`),
`draft` = ein Abschnitt + eine Kurztext-Frage, `theme:{ preset:'projectflow-light', … }`, `settings: { retentionMonths: 12,
confirmation: {}, notifyMemberIds: [ownerId], respondentCopy:{enabled:false}, aiTriage:{enabled:false, categories:[]} }`,
`counts:{responses:0, spam:0, lastResponseAt:null}`, `editorIds:[]`, `embed:{allowedOrigins:[]}`, `actions:{}`.

## Fehlercodes
`form-not-found`, `form-invalid` (+ `details.issues`), `form-legal-missing`, `form-not-published`, `form-closed`, `form-limit`,
`form-already-answered`, `form-session-invalid`, `form-invalid-answers`, `form-upload-invalid`, `rate-limited`,
`plan-form-limit`, `plan-form-responses`, `plan-form-feature`, `plan-storage-limit`, `plan-file-too-large`.
