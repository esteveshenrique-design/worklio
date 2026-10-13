# Worklio — Tradesperson Business Assistant

Standalone edition for one business. Includes customer records, editable quotes with labour/material lines and tax, WhatsApp quote text, print-to-PDF, acceptance recording, job scheduling/completion and a payment ledger. Sample records can be removed in Settings.

## Run on your PC

1. Install **Node.js 24 LTS** from https://nodejs.org (includes npm).
2. Extract this ZIP into a folder you own, such as Documents/Worklio.
3. Windows: double-click **start-windows.cmd**. macOS/Linux: open a terminal in the folder and run **bash start-macos-linux.sh**.
4. Open **http://localhost:3000**. Keep the terminal open. Stop with Ctrl+C.

A prebuilt `dist` folder is included, so the launch scripts do not download dependencies. If that folder is missing, they download dependencies and rebuild the app. Once Node is installed, you can also run `node server.mjs` directly with no dependency download; the server uses only Node's built-in modules.

### Manual commands

```sh
npm ci
npm run build
npm test
npm start
```

## Your data

Records are stored in `data/obra.sqlite`, on your PC, not in browser storage. They survive reloads and server restarts. Stop the app before copying the `data` folder for a backup. Do not delete that folder when updating the app. The server listens only on your PC by default. Do not run multiple app instances against the same database.

## Hosting options

**Railway:** Create an account/project and upload this folder to a repository you own. Deploy using the included Dockerfile. Add a persistent volume mounted at `/data`. Let Worklio detect the generated Railway public domain, or set `APP_ORIGIN` to your exact HTTPS custom-domain URL. Set `SETUP_TOKEN` to a random secret of at least 32 characters for first-admin setup. Generate an HTTPS service domain. Set a health check path of `/health`. The platform supplies PORT. Railway charges depend on your plan and use.

**Render:** Deploy this repository as a Docker Web Service. Add a persistent disk mounted at `/data` (requires a paid service), and set `APP_ORIGIN` and `SETUP_TOKEN` as described above. Use `/health` as the health check. Without a disk, database records can be lost during restart or deployment; do not use an ephemeral service for real customer data.

**Cloudflare:** The original edition targets Workers with D1; it can be deployed on Cloudflare after provisioning the D1 binding and migrations. This standalone SQLite edition targets local Node or Docker hosting, so it is not a drop-in Cloudflare Worker.

An existing website or custom domain is not required. Hosted accounts and payment choices must be made by you. Nothing in this package automatically uploads your source or publishes your data.

## Scope and limitations

- English, European Portuguese, French and Spanish interfaces. Select a language in the top bar; your browser remembers the choice. Dates and euro amounts use the selected locale. Quote previews have a separate document-language selector for PDF and WhatsApp labels. Customer names, job titles and line descriptions remain exactly as entered. Tax rates remain editable and default to 23%; switching language does not change tax rules.
- WhatsApp opens a draft for you to send. Acceptances and payments are recorded by the business owner; customers do not receive an acceptance portal.
- Print/PDF produces a quotation, not a certified invoice. Official invoicing, payment processing, automated reminders and AI quote drafting are not integrated.
- Organization-specific workspaces with a platform super administrator and organization-scoped admin/user roles. Hosted access requires HTTPS. Organization isolation is enforced by the server; instances share the application service and SQLite database.
- Node.js 22.13+ is required; Node 24 LTS is recommended. The built-in SQLite module may print an experimental warning.
- Browser visual QA and installation on your actual PC have not been performed in this session.

## Files

`src/` editable frontend; `dist/` ready-to-use built frontend; `server.mjs` local/hosted server and SQLite storage; `tests/` API checks; Dockerfile for hosted builds; platform launch scripts; package-lock.json for reproducible dependencies.

## Updating an existing local installation

Stop the app. Back up the old `data` folder. Extract this package and replace the app files, including the entire `dist` folder, while retaining your existing `data` folder. Start normally, then refresh the browser. No database migration is needed. This package contains no customer database.

## Frontend organization

Each main view is in its own file under `src/views/`: OverviewView.tsx, QuotesView.tsx, CustomersView.tsx, JobsView.tsx, PaymentsView.tsx and SettingsView.tsx. `src/components/QuoteTable.tsx` holds the shared quote table. `src/types.ts` holds common data types. `src/App.tsx` coordinates navigation, saved workspace state, translations and editor dialogs.

## Color theme

The interface uses the uploaded invoice’s orange (#FF9966), peach (#FFCC99), gray (#C0C0C0), blue (#0066CC), and black-on-white palette. The quotation totals and favicon follow the same palette.

## Item VAT and subject groups

In the quote editor, use Add group to create your own subjects (for example Electricity, Construction or Painting). Rename groups directly and select a group for each item. Removing a group retains its items as Ungrouped. Groups belong to each quote.

Each item has its own editable VAT percentage, including zero or decimal rates. Unit prices exclude VAT. Default VAT for new items affects newly added items; existing item rates are retained. Old quotes without item VAT continue to use their original quote tax rate. Totals round the net amount and VAT of each line to cents, then add them. Quote previews/PDF and WhatsApp drafts show grouped items and VAT totals per rate. The quote lists display the applicable VAT percentages. Keep the existing data folder when updating.

## Reusing subject groups

Each item’s Group dropdown lists the current quote groups and unique group names from other saved quotes. Choose one to copy it into the current quote and assign the item. Choose New group… to enter a name inline, then press Add group or Enter. Existing names are reused without duplicates. New names become available to other quotes after saving. Imported groups can be renamed independently without changing older quotes.

## Inline dropdown and grouped editing

Open an item’s Group dropdown to select a saved group or type a new name directly inside the dropdown and press Add group (or Enter). Items immediately move into their group’s section. Each section has an editable heading, a subtotal and its own Add line item button. The form and exported PDF use the same group order, with ungrouped items last. Removing a section group retains its items under Ungrouped.

## Registered users and administrator setup

On first launch, open exactly the address shown in the terminal (normally http://localhost:3000). The terminal displays a one-time administrator setup code. Enter it in the setup screen and choose your name, email and password. Passwords must contain 15–128 characters. There is no public self-registration. After setup, the super administrator creates the first organization and its administrator from Settings. Within an organization, administrators can open User management from the navigation or the shortcut in Settings to create admin or regular accounts and enable or disable users. Disabling an account revokes its sessions immediately. Re-enabling requires a new sign-in. The last administrator and your own account cannot be disabled. Settings includes Change password; changing it ends all sessions for that account.

Accounts and the existing business records live in the same local SQLite database. Keep the entire data folder when updating. Business records are shared only by enabled registered users within the same organization. Existing quotes and customers are retained; no accounts are created automatically from the old APP_USER/APP_PASSWORD variables. The setup code establishes the first platform super administrator.

Passwords use salted scrypt hashes. Sessions use random server-side tokens stored as hashes, HttpOnly SameSite cookies, an eight-hour maximum lifetime and a thirty-minute idle timeout. Mutating requests check the configured origin and a session CSRF token. Login attempts are rate limited, and server-side authorization protects account administration and all business data APIs. The public shell only displays sign-in/setup; no live business records load before authentication. Cookies become Secure when APP_ORIGIN is HTTPS.

### Hosted configuration

On Railway, generate a public domain under Settings → Networking → Public Networking. Worklio automatically uses `https://` plus Railway’s `RAILWAY_PUBLIC_DOMAIN` when `APP_ORIGIN` is absent. For another provider or an explicit custom domain, set APP_ORIGIN to the exact HTTPS origin, such as https://your-app.example.com (no path). A trailing slash is normalized automatically. Use HTTPS through your hosting provider’s reverse proxy. Its forwarded Host must match that origin. Set SETUP_TOKEN to a random secret of at least 32 characters before the first launch; use it once in the setup form, then remove it from the service’s environment. Keep the /data volume. The previous APP_USER/APP_PASSWORD settings are no longer used. Do not expose the local HTTP server directly to the internet. Protect access to database backups: they contain business data and account hashes.

The current version supports administrator-created credentials and self-service password changes. It does not include MFA, email verification or an email password-reset service. A public production rollout still needs deployment-specific review, HTTPS configuration and operational monitoring.

Sign-in, user management, grouped quote editing and the main workspace include mobile and tablet layouts. Browser visual QA on your own device has not been performed here.

Administrators can edit existing users’ names, emails, roles, and passwords using Edit user. Leave the new password blank to retain it. Email, role, and password changes revoke the affected user’s sessions. You cannot demote yourself or the last active administrator. User management is available as a direct navigation link, through Settings, or by opening http://localhost:3000/#user-management (use your configured origin if different).

To create a budget from an existing one, open any quote and choose Clone quote. The editor opens an independent draft with a new number and today’s date, retaining the customer, title, items, groups, quantities, prices and VAT rates. Review and save it; cancelling leaves no new quote. The original quote and its jobs or payment status are untouched.

Quote, customer and job editors keep their headings and save buttons visible. Budget items scroll inside the form; customer and job fields use their own scroll area when needed.

Read-only quote previews also retain the document heading and action buttons while items and detailed totals scroll. The total stays visible above the actions. Printing/PDF expands the complete item list without scroll clipping.

Quote dialogs are wider in view and edit modes. Export PDF downloads a formatted A4 document; Export Excel downloads a native .xlsx workbook with editable quantities/prices/VAT and recalculating line amounts and VAT summaries. Both follow the DEVIS 583 spreadsheet’s orange banner, dated customer box, numbered trade sections, item codes, unit column, group totals and acceptance area, adapted for quotes. Add optional business address, VAT ID, registration, payment terms and bank details in Settings. The export uses the selected Document language. Reference invoice names, bank accounts, legal text and deposits are not copied. Export libraries/template are included: no extra Python/Excel installation is required.

PDF and Excel exports now follow the supplied DEVIS 583 spreadsheet: company block at left, dated customer box at right, orange quote banner, numbered trade sections and item codes, units, quantities, prices, per-item VAT and separate group totals, followed by VAT/totals and acceptance/signature fields. Reference logos, certifications, personal data and legal clauses are not copied. Units can be entered on each quote item.

Settings includes Company logo: choose PNG/JPEG up to 5 MB, preview or remove it, then Save business details. Images are resized to fit, preserving aspect ratio and PNG transparency. The saved logo appears in the app branding, quote preview and PDF/Excel exports. It is stored with the business workspace and retained in the data folder.

Settings shows Business details first, then Company logo, then Application colors for administrators. Choose **Upload logo**, select a PNG/JPEG, then click **Save logo**. It applies to the app and both exports. To update an existing installation, stop Worklio, replace its application files with this package while keeping your existing `data` folder, restart using your platform start script, and refresh the browser with Ctrl+F5.

Each budget item has a **Unit of measure** dropdown. Previously saved budget units are reused; there are no preset units. Type a custom unit directly into the editable dropdown, then save the budget to make it available in future budgets. No separate Add action is needed. Blank units are allowed. Units appear in budget previews, PDF and Excel.

## Import a budget from Excel
On Overview or Quotes, choose **Import Excel** and select an `.xlsx` exported by Worklio or an `.xls` saved in the same layout (up to 10 MiB / 10,485,760 bytes). The importer includes a vendored SheetJS CE 0.20.3 reader for legacy `.xls` files, requiring no additional installation. It supports Excel shared strings and cached numeric formula values. It preserves groups, item descriptions, units, quantities, prices and VAT, and opens a new Draft with a fresh quote number and today’s date. An existing customer is suggested by name/email; confirm or select the customer and review the draft before **Save quote**. Existing records are not overwritten, and cancelling leaves the workspace unchanged. Files with invalid values, unsupported layouts, external workbook links or VBA content are rejected. Imported company details and logos do not replace your settings.

## Application colors
Administrators can use **Settings → Application colors** to select accent, secondary, background, panel, text, border and link colors, save them for all workspace users, or reset the defaults. Changes survive restarts. The server rejects color changes from ordinary users, including direct API requests. Colors affect the app; PDF/Excel keep the agreed export template.

Forms use compact responsive field grids: related business, customer, user and password fields share rows on desktop, while mobile layouts stack fields. Budget title/customer/date share a row on wide screens; item entry keeps quantity, price and VAT labels visible on phones. Customer and job dialogs size to their contents with save actions outside scrolling fields.

## Invoices from approved quotes
Open an Accepted, Completed or Paid quote and choose **Create invoice**, or open **Invoices → Create invoice** and select the approved quote. Check a group to include all its remaining uninvoiced items, or check individual items for partial billing. Each selected item is invoiced for its full quoted quantity. Already invoiced items stay visible and unavailable. Add invoice-only work using **Add item**, with a description, unit, quantity, price and VAT percentage; these extras do not modify the original quote.

Review the date, selection and total, then choose **Save invoice** to create a Draft. Cancelling does not reserve items. Saving assigns the next `INV-0001` style number and reserves the selected quote items. Concurrent requests and direct API calls cannot invoice a source item twice. Quote item order, groups, customer and VAT are locked after the first invoice to preserve source references; invoice-only extras can still be added in subsequent invoices. Draft invoices can be opened and changed with **Edit invoice**: select or deselect quote items/groups, add or remove invoice-only extras, and save. Removed quote items become available again, while items reserved by other Draft or Final invoices remain unavailable. A draft must retain at least one item. Choose **Mark final → Confirm final invoice** when finished; Final invoices cannot be edited, including through direct API requests. Existing invoices from earlier releases with status Issued are treated as Final. To remove an invoice, open it in Invoices, choose **Delete invoice**, review the message and choose **Confirm deletion**. Its quote items become available again, while items on other invoices remain reserved. Invoice-only extras are removed with the invoice. Invoice numbers are never reused, including when all invoices are deleted. Credit notes are not implemented.

Open an invoice in **Invoices** to view it or export PDF/Excel in English, Portuguese, French or Spanish. Exports retain the agreed table format, company logo, groups, units and per-item VAT, and include the original quote number. Invoice company/customer details and commercial values are snapshots at issue time. Later settings or customer changes do not rewrite historical invoices. Payment tracking continues to use the existing quote payment ledger.

All enabled registered users can issue and view invoices. No database migration or new environment variable is needed. For local updates, keep the existing `data` directory. On Railway, replace the application files in your repository and redeploy with the existing `/data` volume attached.

Invoice deletion is available to all enabled registered users and is protected by authentication, CSRF validation and the workspace version check. The quote’s item/group lock is removed when its last invoice is deleted. Changes to invoices and invoice numbering through a general workspace save remain blocked. Previously exported files are not removed from your computer when an invoice is deleted.

Invoice lists and previews show Draft or Final. Draft PDF/Excel exports are labeled as draft invoices. Draft edits preserve the invoice number and original company/customer snapshots. Finalization retains the contents and adds who finalized the invoice and when. Final invoices can still be deleted using the explicit delete action; this releases their source items as requested. No transition from Final back to Draft is available.

## Updating from Obra to Worklio
Keep the existing `data` folder or Railway `/data` volume when updating. Worklio keeps the database filename `obra.sqlite` and existing session/language identifiers for compatibility, so the rename does not require new administrator setup. The organization upgrade performs the database migration described below automatically. The downloaded project folder is now named `worklio-local`.

## Railway startup error: APP_ORIGIN
Update the repository with this package, including `server.mjs`, `hosting.mjs` and `Dockerfile`. Ensure your Worklio service has a generated public domain, then redeploy. The domain is detected automatically when APP_ORIGIN is unset. If you previously added APP_ORIGIN with an incorrect or HTTP URL, remove it to use Railway’s domain or replace it with your exact HTTPS site URL. Explicit APP_ORIGIN takes precedence. Keep the existing `/data` volume and other environment variables.

## Organization instances and roles
The first administrator created through the setup screen is the **Super administrator**. On a new installation, only Settings and the organization creation form are displayed until an organization exists. Create the organization with its business details, logo, application colors and initial organization administrator’s name, email and password. Creation is atomic: invalid settings or a duplicate administrator email leave no partial instance. Creation automatically switches the super administrator into the new organization’s empty environment.

Within **Settings → Organizations**, the super administrator can create further instances, switch to an enabled instance, and enable or disable any instance. While the creation form is open, other workspace sections are hidden. Organization management is available only to the super administrator and only in Settings. A disabled active instance returns the super administrator to platform Settings, where it can be enabled again or another organization selected.

Organization administrators manage their own business settings, logo, colors and users. They can create regular users and other administrators linked to their own organization, and edit, enable or disable those accounts. They cannot grant super-admin privileges, move accounts between organizations or access another organization’s users. Each organization’s last enabled administrator is protected. Regular users can work with their organization’s business records and change their own password; only administrators can change organization settings.

Customers, quotes, invoices, numbering, jobs, payments, historical groups, units, logos and colors are scoped to the active organization. Exports use saved data from that organization. The organization comes from the authenticated server session, with context validation on each request; client-supplied organization IDs do not grant access. Switching rotates CSRF protection and remounts the workspace to clear the previous organization’s views and editors. Writes and exports spanning a context switch are rejected. Organization users cannot switch to another organization. User email addresses remain globally unique across the application.

Disabling an organization immediately revokes its users’ sessions and blocks sign-in and workspace access. Its data is retained; re-enabling permits new sign-ins and restores access to the existing records. Other organizations remain available. Super administrators retain the platform controls while an instance is disabled.

### Upgrade existing installations
Back up the existing data directory before upgrading, then keep the same `data` directory or Railway `/data` volume. The migration runs transactionally at startup and retains business records, quote/invoice IDs and workspace versions. Existing users and records are assigned to one organization. The earliest enabled administrator (ordered by creation time, then ID) becomes the platform super administrator; other accounts retain their roles in the original organization. If that organization has no separate organization administrator yet, the super administrator can create one through its User management page. Existing sessions are assigned to the original organization. Refresh the browser after deployment. No new SETUP_TOKEN or public registration is required for existing accounts.

Update all application files, including `auth.mjs`, `organizations.mjs`, `server.mjs` and `Dockerfile`, together. The frontend and server organization context must be upgraded together. Organization instances are logical workspaces in one application deployment, not separate Railway services or databases.
