# PCMS — Client Specification

**Status:** Accepted client specification (Sections 1–7), with accepted clarifications through 31 October 2026. Engineering decisions marked Open remain pending.

## 1. Rules

These rules apply to this document and PCMS development.

1. **Keep PCMS small (KISS).** Add a function, tool, or procedure only if it is necessary.
2. **Use ASD-STE100 Simplified Technical English.** Write short sentences. Use one term for each meaning.
3. **Obey this specification.** Do not change an accepted requirement without user approval. Identify all open decisions.
4. **Keep modules small.** Give each module one task. Do not put the same task in two modules.
5. **Automate usual work.** Do not make the user click more controls or give approval for each usual step.
6. **Prevent damage to existing work.** Keep accounts isolated. Make sure that an uncertain operation is complete before you try it again. Do not overwrite source code.
7. **Make sure that the results are correct.** A test PASS does not prove that Perchance completed an operation.

### Module descriptions

Specify these items for each module:

- **Purpose:** The task of the module.
- **Workflow:** The sequence of steps.
- **Success:** The method used to make sure that a result is correct.
- **Failure:** The response to an error.
- **Limits:** The work that the module must not do.

Examine one section at a time. Do not change a different section until the user accepts the change.

## 2. Purpose

PCMS is a Firefox extension. It manages Perchance accounts and generators in one interface.

PCMS creates generators, deploys code, publishes completed generators, and refreshes eligible generators. PersonaMonkey is part of the same PCMS extension. PersonaMonkey isolates accounts and controls routes.

PCMS must do usual work automatically. It must keep work status and continue safe work after an error or Firefox restart. PCMS must operate while Firefox is open, with the dashboard closed or open.

PCMS must operate with a minimum of 50 accounts and 1,000 generators. These numbers are minimum capacities, not upper limits.

PCMS must not register new Perchance accounts. It must not contain a second route controller.

## 3. Basic Terms

Use one term for each operation.

| Term | Meaning |
|---|---|
| **Slug** | The name in a generator's Perchance URL. |
| **Source** | All generator code files: the main `.pjs` file, the HTML file, and all source files in `src/`. |
| **Create** | Make a generator in Perchance, save it, and set the specified slug. |
| **Develop** | Write or change the generator's source. |
| **Deploy** | Put the selected source version in Perchance, save it, and make sure that the saved source is correct. |
| **Publish** | Make a completed generator public. Add it to the Refresh Pool. Make sure that the two operations are complete. |
| **Refresh** | Change source without a change to its function. Save the source to update the generator's recency. |
| **Refresh Pool** | The generators that Refresher can manage. |
| **Listed** | A generator that Perchance can show in its public generator directory. |
| **Unlisted** | A generator that Perchance does not show in that directory. |

**Rule:** Deploy and Publish are different operations. A saved source version is not necessarily published.

## 4. PCMS Structure

**Status:** Accepted.

PCMS is **one Firefox extension**. It contains PersonaMonkey, the PCMS Core, and modules. PersonaMonkey is built into PCMS. PersonaMonkey is not a different extension or an optional module.

### PCMS Core

**Purpose:** Give shared functions to modules. Each module does its own work.

The core must:

1. **Use PersonaMonkey automatically.** PersonaMonkey controls Personas, protected routes, and account tabs. Make sure that a protected route is correct before an account tab starts work. If the route is not ready, stop work for that account. Do not use a Direct route as a fallback.
2. **Manage modules.** Install, update, enable, and disable modules without a PCMS reinstall. Keep module settings and unfinished jobs.
3. **Share records and access.** Keep one set of account, generator, GitHub folder, and job records. Give modules the necessary data and GitHub access.
4. **Connect modules.** Send work requests and results between modules. Each module controls its own operations.
5. **Manage one shared work queue.** Record each waiting, active, completed, or failed job. Do not start the same job two times. Do not let two modules write to the same generator source at the same time. Continue work for other generators. Do not let a large batch stop other jobs. Before a module saves source, make sure that it will not overwrite manual edits.
6. **Keep work status.** Keep jobs and schedules when the dashboard closes. Restore schedules and registered userscripts at Firefox startup. After a restart, examine uncertain Perchance and GitHub writes. Do not write again until you know the result. PCMS can operate only while Firefox is open.
7. **Limit active work.** Do not keep a tab open for each generator. Control browser load with 1,000 or more generators.
8. **Give data to Journal and Backup.** Record work when Journal is paused or updating, or when PCMS is paused. Give Journal the data for search and export. Give Backup one consistent snapshot of all PCMS and PersonaMonkey data, with credentials. Stop source writes during a restore. Do not put credentials in Perchance pages or diagnostic logs.
9. **Include Pause and Resume.** Include the **Pause PCMS** and **Resume PCMS** controls. Apply the rules below.

### Modules

Each module has one primary task. Modules can send work requests to other modules through the core.

For example, Discover makes a GitHub folder. Creator makes the generator. Deployer publishes it. Refresher manages it.

**Module updates:** The core must stop new jobs for a module before it stops or updates that module. It must keep unfinished jobs. An active operation must finish or stop safely. Do not operate two versions of the same module at the same time. If a new version cannot read a saved job, keep the job and report the error. At startup, the module must find its unfinished work. Other modules must continue.

**Module structure:** A module can contain a userscript for Perchance pages and background code. The background code does work for which a Perchance page is not necessary. These parts belong to the same module. PCMS must update the module without an extension reinstall.

**Module packages:** The user installs or updates a module by selecting a compatible ZIP file in Settings → Modules. PCMS must validate the package format and compatibility, and report a clear error if it cannot use the package. A remote module store, automatic downloads, and a separate module installation service are not required. Do not add an approval procedure for each ordinary user-selected ZIP. The user keeps Firefox updated; the engineering design must name and test any minimum Firefox API version it actually needs. Firefox ESR 153.5.0esr is the user's current version, not a permanent compatibility limit.

### Pause and Resume

- **Pause PCMS:** Stop new automatic jobs in all modules. Let an active operation finish or stop safely. Keep unfinished jobs and work status. Show the Paused status.
- **While paused:** Do not start new Perchance or GitHub writes. Keep PersonaMonkey route protection active. Keep Journal, automatic Backup, and read-only status available.
- **Resume PCMS:** Examine each affected account, route, source, and job. Continue unfinished work only if it is safe. Do not do an uncertain operation again. Do not send many missed refreshes together.
- **After restart:** If PCMS was paused when Firefox closed, it must stay paused.
- **Refresher time:** Paused time does not count as Active time. Sleep time continues.

### Limits

The core must not create generators, deploy code, or refresh generators. It must not contain a general workflow engine or a second route controller.

## 5. PCMS Modules

### 5.1 Accounts — `pcms-accounts`

**Purpose:** Add and manage Perchance accounts. Use PersonaMonkey automatically for Personas, routes, and account tabs.

**Workflow — Add account**

1. The user clicks **Add Account**.
2. PCMS uses PersonaMonkey to prepare an isolated Persona and a protected route.
3. PCMS opens Perchance in that Persona.
4. The user signs in and clicks **Confirm**.
5. **After** the user clicks Confirm, PCMS makes sure that the account identity and route are correct.
6. If the two checks are satisfactory, PCMS saves the account for future work.

**Other operations**

- **Archive:** Stop new work for an account. Keep account data and its Perchance generators.
- **Reactivate:** Examine the account and route. Continue unfinished work only if it is safe.
- **Remove:** Remove local account data after user confirmation. Do not remove Perchance generators.

**Success:** PCMS uses the correct account and an isolated, verified route. The user does not have to set up PersonaMonkey manually.

**Failure:** PCMS tries to repair route or connection errors. If a login or challenge is necessary, PCMS tells the user. Stop only the affected account. Do not try an operation again if its result is unknown.

**Limits:** Do not register Perchance accounts. Do not use an unprotected Direct route. Do not share a Persona or known exit address between accounts. Do not change an account identity without notice.

### 5.2 Discover — `pcms-discover`

**Purpose:** Examine the slugs in user lists. Make GitHub folders for available slugs. Creator then creates the Perchance generators.

**Workflow — Check and prepare**

1. The user pastes a list of slugs into Discover.
2. Discover removes invalid names and duplicates. It normalizes the names.
3. Discover opens one Perchance slug page at a time. It uses an interval between checks.
4. Discover examines the page and records one of these results:
   - **Available:** The page shows this exact visible text:

     ```text
     (⊙.⊙) sorry, we cannot find a generator with that name! create one?
     ```

   - **Taken — reserved name:** The page shows this exact visible text:

     ```text
     (⊙.⊙) sorry, this is a reserved name - had to do this because a few users where "name-squatting" on lots of common words and not actually using them ¯\_(⊙_ʖ⊙)_/¯
     ```

   - **Taken — existing generator:** A generator page has actual generator content. The content can be in a frame, as at `https://perchance.org/image-generator`.
   - **Unknown:** The page has a security challenge, connection error, missing content, or no clear result. Other page text alone is not proof of Taken status.

   **Text check:** Keep all letters, spelling, punctuation, and symbols in these two messages unchanged. The text `create one?` can be a link. Use its visible words, not the link URL. Ignore only whitespace that page layout adds. A partial or changed message is **Unknown**, unless real generator content independently proves **Taken**.
5. Discover saves each result and its check date. The user can pause or resume the queue. Keep results after Firefox restarts.
6. For each **Available** slug, Discover creates only `generators/<slug>/DEPLOYMENT.md` on GitHub `main`. The deployment status in this file is **not ready**.
7. Discover makes sure that the folder exists. Creator then finds the folder and starts generator creation.

**Controls:** Import list, Start, Pause, Resume, and Export results. Do not examine a completed slug again unless the user requests it.

**Success:** Discover shows the results and the GitHub folders that it made. These folders contain no initial source files.

**Failure:** For an Unknown result, stop checking until the user resumes. Keep completed results and unfinished work. Do not make a folder for Unknown or Taken. Do not overwrite existing GitHub files.

**Limits:** Discover must not create Perchance generators, develop source, deploy code, or publish generators. Available status does not reserve a slug. Creator must examine the slug again before creation.

### 5.3 Creator — `pcms-creator`

**Purpose:** Create Perchance generators from GitHub folders. Allocate new generators as equally as possible across all eligible managed accounts.

**Workflow — Create generator**

1. Find each new `generators/<slug>/` folder with `DEPLOYMENT.md` on GitHub `main`. No user click on Start is necessary.
2. Find out if the generator exists. If a managed account owns it, connect it to the folder when there is no conflict. Do not change its source or listing. If a different account owns it, report the conflict.
3. If the generator does not exist, examine the slug again. If it is **Available**, create it. If it is **Taken**, reserved, or **Unknown**, do not create it.
4. Count the generators owned by each managed account that is not archived. Include allocations for generators not created at this time.
5. Select the account with the lowest total. If the user selects an account, use that account. These totals are not account limits.
6. Use PersonaMonkey automatically to open Perchance with the selected account.
7. Create and save an unlisted generator. Change its slug to the specified slug.
8. Make sure that the saved slug and account ownership are correct. Keep the connection between the generator and its GitHub folder.

**Success:** The correct account owns the generator at the specified slug. PCMS records the result and can start the next generator automatically.

**Failure:** Keep unfinished work. If a save or slug change has an unknown result, examine Perchance before you try again. Stop only the affected generator when it is necessary.

**Limits:** Do not create accounts or duplicate generators. Do not change the source of an existing generator. Do not deploy source or publish generators. A GitHub folder can start creation when `DEPLOYMENT.md` is not ready. Only Deployer uses deployment readiness.

### 5.4 Deployer — `pcms-deployer`

**Purpose:** Develop or deploy a generator, then publish it. Use the same procedure for the first version and subsequent updates.

**Deployment instructions**

Each generator has `generators/<slug>/DEPLOYMENT.md` on GitHub `main`.

The file specifies **version**, **action**, and **status**:

- **Action: DEVELOP** — Use Perchance AI Helper to develop or update the generator.
- **Action: DEPLOY** — Copy completed source from GitHub to Perchance.
- **Status: READY** — Start the selected action automatically.
- **Status: DONE** — PCMS published the selected version.

**Open:** The field names and file format are not specified at this time.

A new version with `Status: READY` starts a task. If a version is published, the new task updates that generator. A different update mode is not necessary. Deployer waits for Creator if the generator does not exist.

**Workflow — DEVELOP**

1. Read `specification.md`, `ui.md`, `agents.md`, and `prompt.md` from the generator's GitHub folder.
2. Put the first three files in the generator's Perchance `src/` folder. Save them. Make sure that they are stored correctly.
3. Open the generator in a Perchance tab under the correct Persona and protected route. Keep this tab open during AI Helper development. Open a **new** AI Helper chat in this tab. Send the text of `prompt.md` without changes.
4. AI Helper develops or updates the generator in the open tab. PCMS must keep this tab available while the job is active. The PCMS dashboard can be closed. PCMS does not reproduce AI Helper's worker, streaming protocol, chat history, or workspace. It only stages files, sends the prompt, keeps the tab and job context, and observes enough state for a safe handoff or an Unknown hold.
5. When AI Helper completes its work, show **Review in Perchance** in Work and Generators. This PCMS dashboard control must focus the correct open generator tab and AI Helper chat. After review, the user clicks **Finish and publish**, a **PCMS-provided control inside the Perchance editor**. Perchance does **not** supply this PCMS control. Do not mark user acceptance complete before the user clicks it.
6. The click starts PCMS completion work. PCMS must examine the accepted editor state, safely save the completed source if necessary, and verify the actual saved `.pjs`, HTML, and other source files before GitHub writeback. Do not assume that AI Helper already saved all source. If source, ownership, or save status is uncertain, hold the job and give a contextual recovery action. The user must not have to perform a separate manual save or publication step.
7. Save the completed source in the same GitHub folder. Make sure that the save is complete. Do **not** change the initial `specification.md`, `ui.md`, `agents.md`, or `prompt.md` in GitHub.
8. Make the generator public. Add it to the Refresh Pool. Make sure that the two operations are complete.
9. Mark that version **DONE** in `DEPLOYMENT.md`.

**Workflow — DEPLOY**

1. Read the completed source for the READY version from GitHub. Include `.pjs`, HTML, and the applicable `src/` files.
2. Use the correct account and PersonaMonkey to open the generator.
3. Save the source in Perchance. Make sure that the saved source is the selected version.
4. Make the generator public. Add it to the Refresh Pool. Make sure that the two operations are complete.
5. Mark that version **DONE** in `DEPLOYMENT.md`.

**Updates**

- DEVELOP and DEPLOY can also update an existing generator. A third mode is not necessary.
- Keep a copy of the previous correct source before an update.
- Pause Refresher for the generator during a Deployer source change.
- Do not change other generators. Do not overwrite unsaved manual edits.
- A new READY version must not start a previous completed version again.
- A PCMS GitHub write must not restart the same task.
- A DEVELOP job requires its Perchance tab to remain open during development and user review. Do not close or reuse that tab for unrelated work. If the tab closes, reloads, or loses its AI Helper state, hold the affected job. Examine the saved source and chat state before continuing. Do not open a new chat or send `prompt.md` again without this check.
- **Finish and publish belongs to PCMS.** Show it only in the correct generator editor and only when that job is ready for user acceptance. A click is a user acceptance of the reviewed result and starts the automatic PCMS completion sequence. Do not make it part of the generator source or published page. A second manual publication procedure is not required.

**Success:** The correct version is saved. The generator is public and in the Refresh Pool. GitHub records the completed version.

**Failure:** Keep the previous source and unfinished task. Examine uncertain saves before you try again. Do not mark a failed version DONE. Do not publish source that is not complete.

**Limits:** Deployer must not create accounts or generators. Only the selected generator and its GitHub folder can change.

**Update visibility:** Make an existing generator unlisted before Deployer changes its source. Make it public again only as part of a successful, verified publication. If the update fails, keep it unlisted until the problem is corrected.

### 5.5 Refresher — `pcms-refresher`

**Purpose:** Keep the maximum possible number of user-owned generators on the Recently Updated Generators page. Use these priorities: **top 50**, **top 100**, **full displayed list**.

**Directory:** https://perchance.org/generators

**How the directory operates**

- `/api/getGeneratorList?max=1000` requests a maximum of 1,000 recently changed, listed generators.
- The page filters some results and moves pinned generators before the usual sequence.
- Approximately 735 generators were displayed during one observation. This is not a fixed limit.
- A save can change a generator's position. It does not make sure that the generator gets a position in the list.

**24/72 cycle**

- Each generator in the Refresh Pool has an **Active** period followed by a **Sleep** period.
- The default is **24 hours Active, then 72 hours Sleep**. The two durations are configurable. The cycle is mandatory.
- Only Active generators can be refreshed. During Sleep, the generator stays public and PCMS does not refresh it.
- Active time counts only while PCMS can do work. Sleep time continues while Firefox is closed.
- Adjust the start times to prevent too many generators from sleeping together.
- The number of Active generators does not change the priorities. With 30, 60, 90, or more Active generators, use the **top 50 first**, then **top 100**, then **full displayed list**. Apply this sequence at all times.

**Workflow**

1. Find **available Active generators**. These must be public and Active. Do not select a generator in development, blocked, or being edited by a user.
2. Examine the displayed directory. Count user-owned generators in the **top 50**, **top 100**, and **full displayed list**. Use the actual displayed sequence, with filters and pinned entries.
3. Select generators for Refresh. Select for the top 50 first, then the top 100, then the full displayed list.
4. Adjust the selection and Refresh frequency to the quantity of available Active generators and their measured positions. Do not refresh a Sleeping generator to fill a target.
5. Refresh **as many Active generators as necessary, as frequently as necessary**, to keep all three targets. The same generator can receive more than one Refresh during its Active period. Make sure that results are correct. Do not make two source changes to the same generator at the same time.
6. Before each save, make sure that the account, source, and public status are correct. Replace one short marker in the `.pjs` and HTML files. The marker must not change the generator's function. Save the source. Make sure that the stored source is correct.
7. Examine the displayed directory again. Record changes in positions and counts. Use these results to select subsequent work.
8. Keep cycle times and unfinished work. Continue safely after Firefox restarts.

**Scheduling rules**

- **Monitor:** Count eligible Active generators. Record their positions in the displayed list.
- **Select:** Apply the specified priorities. One observation can select more than one generator.
- **Check:** Compare new counts and positions with previous values.
- **Adjust:** Use these results to select subsequent generators and the Refresh rate. Do not use one fixed rate for all pool sizes.

The selection method, observation interval, and safe Refresh rate are not specified.

**Success:** Measure the number of user-owned generators in the top 50, top 100, and full displayed list during regular observations. A source save by itself is not a measure of success.

**Failure:** A directory result that is not complete is not proof that a generator is missing. If a save fails or its effect is uncertain, find the cause before you try again. Stop only affected work. Do not send many missed saves after a restart.

**Limits:** Do not refresh Sleeping, Unlisted, or developing generators. Do not overwrite manual edits or change generator functions. Do not bypass Perchance filters or access controls. Do not use a position as a permanent value.

**Open:** Specify the selection algorithm, observation interval, and safe Refresh rate.

### 5.6 Journal — `pcms-journal`

**Purpose:** Record all PCMS work in the background. Keep records for debugging. Export records to the user's hard drive automatically.

**Workflow**

1. Record operations from the core and all modules. Include automatic work and requests between modules.
2. Record the time, target, steps, result, and errors of each operation. Include necessary debugging data.
3. Keep records when work occurs and after Firefox restarts. Let the user search and filter the records in PCMS.
4. Export Journal records automatically to the configured Downloads folder at regular intervals. Let the user export records manually when the user requests it.
5. Make sure that each export is complete. Report failures. Continue automatic exports when possible.

**Success:** The user can find each PCMS operation and the cause of each error. PCMS keeps Journal records and exports them to disk automatically.

**Failure:** Report missing records or exports that are not complete. Do not report an export as complete if it is not complete. Keep saved records if a disk export fails.

**Limits:** Record PCMS and module work only. Do not record unrelated browser work. Do not put passwords, tokens, cookies, or session secrets in Journal.

**Automatic export and retention**

- Export Journal every **30 minutes** while Firefox is open. After a Firefox restart, continue the schedule. Do not send all missed exports at once.
- Keep automatic Journal exports for **90 days** on disk. Keep **90 days** of Journal records in PCMS. Record all PCMS activity during this period; do not omit operations to reduce the number of records.
- Remove expired automatic files only after a new export completes and the file is recorded as complete. If an export fails, keep the earlier files. Do not remove manual Journal exports. If disk space is low, show a warning. Do not shorten retention automatically.
- Use the PCMS subfolder of the Firefox Downloads folder for automatic files. Report an export failure if Firefox cannot write there.
- These values are defaults. Let the user change the export interval and retention in Settings.

**Open:** Verify automatic file cleanup and export completion in the installed Firefox extension.

### 5.7 Backup — `pcms-backup`

**Purpose:** Keep complete, unencrypted PCMS backups on the user's hard drive. Use the backups to restore data on the same device or move PCMS to a different device with minimum setup.

**Workflow — Backup and Restore**

1. Back up **all data owned or managed by PCMS and the integrated PersonaMonkey extension**. Include accounts, Personas, their links, route selections and settings, and the other records needed to resume PCMS.
2. Include managed account cookies, the necessary Perchance authentication/session storage (including required login localStorage keys), tokens, credentials, generator records, and PCMS-held source copies. Do not infer a valid login from cookies alone.
3. Include installed module files, module settings, unfinished work, Refresher schedules, and Journal records.
4. Export one portable file. Do not use a password or encryption.
5. Automatically save backups to the configured Downloads folder at regular intervals. Let the user make a manual backup when the user requests it.
6. Make sure that each backup file is complete before reporting success. Report data that could not be included.
7. Let the user select a backup file and restore its contents. Include account and Persona links, and sessions where possible. Make sure that the restored data is correct.
8. Let the user move PCMS to a different device. Restore settings, identities, and login data without new account setup where possible.

**Success:** A complete backup is on disk. The user can restore PCMS with credentials and sessions, without doing usual setup again.

**Failure:** Report missing data or a backup or restore that did not complete. Keep earlier backup files. Do not report a complete restore if a session, Persona, or route is missing.

**Limits:** Do not use encryption, passwords, or a second PCMS native service. Do not put older backups in a new backup. **Do not back up the whole Perchance site or AI Helper's chats, drafts, IndexedDB, OPFS workspace, or attachments merely to support DEVELOP.** Capture only site-origin data necessary for managed account authentication, if any, in addition to PCMS/PersonaMonkey-owned records. The destination device requires the combined PCMS extension and the existing installed/configured PersonaMonkey route bridge. OS-level private WireGuard configuration is an external bridge prerequisite, not data that the PCMS extension can silently export. Do not change the existing bridge or add a native export/import service for this backup. Report the missing prerequisite if it prevents route restoration. An external service can reject a restored login session. PCMS must report these limits. Do not report login success without confirmation.

**Automatic backup and retention**

- Make a complete backup every **6 hours** while Firefox is open. After a Firefox restart, do at most one missed backup. Do not create a burst of backups.
- Keep automatic backups for **90 days** on disk. Keep at least one earlier complete backup until a new backup is complete and checked. If a backup fails, do not delete an earlier complete backup. Do not shorten retention without user approval.
- Never remove manual backups automatically. Remove only automatic files that PCMS created and recorded. Do not delete unrelated files.
- Use the PCMS subfolder of the Firefox Downloads folder for automatic files. Report a backup failure if Firefox cannot write there.
- These values are defaults. Let the user change the backup interval and retention in Settings.

**Open:** Verify automatic file cleanup and backup completion in the installed Firefox extension. Make sure which session and Persona data can move to a different device.

## 6. User Interface

**Status:** Accepted.

**Purpose:** The UI must help the user do work. It must be easy to use. The user must not have to learn internal procedures.

### Rules

1. **Keep the UI small.** Show only the necessary information and controls for a task. Use short labels and minimum text. Put technical information in an optional view.
2. **Use one interface.** The Firefox extension icon opens the PCMS dashboard. Do not show a second dashboard, legacy controller, or second popup.
3. **Put controls with their targets.** Show account controls with the account. Show generator controls with the generator. For an error, open the affected item and show the subsequent step.
4. **Automate usual work.** One user operation must start the full task. Do not make the user give approval for usual steps. User input must be necessary for a decision or manual login.
5. **Show actual results.** Show if work is active, paused, complete, failed, or uncertain. Do not report success from a test or accepted request alone.
6. **Make all controls operate.** Each button must do the task given on its label. If an operation fails, show its cause and the subsequent step. Do not show placeholder buttons.
7. **Manage large lists.** Let the user search, filter, and select many accounts or generators. Keep the user's position in a list. Show the status and result of each item in a batch.
8. **Keep a clear layout.** Use the same spacing, alignment, names, and controls on all pages. The UI must work with the keyboard and in small windows. Do not add decoration that is not necessary.

### Navigation — accepted

**Primary navigation, in sequence:** Home · Generators · Accounts · Refresher · Work · Other · Settings.

- **Settings is always last.** Put Journal, Backup, and module settings in Settings.
- **Other opens modules** that do not have a primary navigation entry. Other is for module operation, not module settings.
- **Settings configures modules.** Let the user add a module to primary navigation or remove it. Do not add a module to primary navigation without user selection.
- **Each module has secondary navigation.** Use it only for that module's pages and controls. Do not add a second global menu.
- Make **Pause PCMS** and **Resume PCMS** easy to find in the dashboard.
- Keep primary navigation readable with many pinned modules or a narrow window. Use a compact or scrollable layout. Do not hide built-in pages.

### Home — accepted

**Purpose:** Show PCMS status and work that needs the user's attention. The user must understand the current situation without opening other pages.

**Content**

1. **PCMS status:** Show Running, Pausing, or Paused. Put **Pause PCMS** or **Resume PCMS** beside this status.
2. **Needs attention:** Show jobs that need user input or have an error. Show the affected account, generator, or job. Give one clear next step. Open that item when the user selects it. Group repeated reports of the same problem.
3. **Current work:** Show a short list of active and waiting jobs, with their task and current status. Let the user open the exact job in Work.
4. **Refresher visibility:** Show the measured number of user-owned generators in the top 50, top 100, and full displayed list. Show when PCMS last measured these values. Open Refresher for more information.
5. **Managed items:** Show the number of managed accounts and generators. Open Accounts or Generators for details.

**Display rules**

- Keep each part short. Show only a few items. Use **View all** to open the related page.
- Show tasks that need user input before usual background work. Do not make the user operate a job one step at a time.
- Show no technical logs or long instructions on Home. Keep these in Journal or the related item view.
- If PCMS cannot get current data, show **Unknown** or **Not measured**. Do not show zero or success as a substitute.
- Update the values without losing the user's place or an open item. Home must not stop background work.
- Show a Backup error in Needs attention. Keep backup files and restore controls in Settings.

**Success:** The user can see PCMS status, find work that needs attention, and open the correct item directly.

**Failure:** If a part cannot get its data, show its condition. Keep other parts available.

**Limits:** Home must not contain a second work queue, module settings, or full records from other pages.

### Generators — accepted

**Purpose:** Find and manage generators in one place. Show work that PCMS must do and work that needs the user.

**Generator list**

1. Show one row for each managed slug. Show a GitHub folder that waits for Creator, even if the Perchance generator does not exist at this time. Do not show it as created.
2. Show the slug, account, listing status, and current work status. Keep detailed source and job records in the selected generator's view.
3. Let the user search by slug, account, or GitHub folder. Let the user filter by account, listing status, and work status. Keep the selected filter and position when data changes.
4. Let the user select many rows and examine their status. Do not make a new operation available only because many rows are selected.
5. Show current status from confirmed results. If ownership, source, or publication is not confirmed, show **Unknown** or **Needs attention**, not **Published**.

**Generator details**

1. Select a row to open its details without losing the place in the list.
2. Show the confirmed owner, Perchance slug, GitHub folder, source version, listing status, and Refresh Pool status. Show **Unknown** when a result is not confirmed.
3. Show the current task and its subsequent step. Link to the correct job in Work for more information.
4. Put the applicable controls with this generator. Examples: **Open Perchance**, **Open editor**, and **Open GitHub folder**. Use the correct account and Persona for Perchance actions.
5. If an operation is held, show the cause in short words. Give the correct recovery operation at this generator. Do not send the user to unrelated Settings.
6. If Creator has not started, let the user select the target account for this generator. Otherwise, Creator selects the account automatically, as specified in Section 5.3.

**Discover and automatic work**

- Put **Check slugs** in Generators. It opens Discover's module view. The user can paste slugs, start or pause checks, see **Available**, **Taken**, or **Unknown** for each slug, and export the results.
- Show creation and deployment work in the same generator list. Creator finds GitHub folders automatically. Deployer acts on **READY** versions automatically. Do not make the user start these tasks from a second control panel.
- For **DEVELOP**, show when Perchance AI Helper is active. If the user must inspect the result, open the correct Perchance editor or chat. The user uses the **PCMS-provided Finish and publish control inside the Perchance editor** after acceptance, as specified in Section 5.4.
- Show completed versions only after PCMS confirms the Perchance source, publication, and GitHub result. Do not use a successful request alone as proof.

**Success:** The user can find a generator, see its actual condition, and do the necessary operation. The user can check many generators without opening each one.

**Failure:** Keep the selected generator and user input when an operation fails. Show the affected account, generator, or GitHub folder and the subsequent step. Continue other work.

**Limits:** Do not add a second generator manager or a manual Start control for each automatic Creator or Deployer job. Do not change source from list controls. Do not replace human edits. Do not repeat an uncertain creation or deployment operation.

### Accounts — accepted

**Purpose:** Add and manage Perchance accounts in one place. Show account identity, login, and protected route status.

**Account list**

1. Show one row for each managed account. Show its name, login status, route status, managed generator count, and Archive status. Show **Unknown** if PCMS cannot confirm a value.
2. Let the user search and filter accounts. Keep the selected account and list position when data changes.
3. Show problems at the affected account. Do not make the user open Settings to find the cause.
4. Open an account to show its details. Do not open PersonaMonkey in a second interface.

**Add account**

1. Put **Add Account** at the top of Accounts. One click starts the enrollment procedure in Section 5.1.
2. PCMS prepares the Persona and protected route automatically. PCMS then opens Perchance in the correct Persona.
3. Show **Complete login** while the user signs in. Show **Confirm** for the user to select after login.
4. Only after **Confirm**, PCMS must check the Perchance identity and protected route. Show **Ready** only if these checks are satisfactory.
5. If login or a check is not complete, keep the enrollment record. Show the next necessary step. Do not start generator work for this account.

**Account details and controls**

1. Show the confirmed Perchance identity, linked Persona, route status, and the time of the last satisfactory check. Do not show a stored identity as newly confirmed if the current result is unknown.
2. Show the managed generator count and a link to Generators, with this account selected.
3. Put **Open Perchance** with the account. It must open the correct Persona and protected route.
4. Let PCMS repair a route automatically. If repair does not succeed, show **Repair route** and a short cause at the account. Do not offer Direct as a fallback.
5. Put **Archive**, **Reactivate**, and **Remove** in the account details. Follow Section 5.1. Make the user confirm **Remove**. Explain that Remove deletes local account data, not Perchance generators.
6. Show the account's unfinished jobs when necessary. Open the correct job in Work.

**Success:** The user can add an account, confirm the login, see its protected status, and manage it without a second extension or technical setup procedure.

**Failure:** Show the affected account and one clear next step. Keep other accounts available. Do not claim that login or route verification is complete without a satisfactory check.

**Limits:** Do not expose credentials in the list. Do not use an unprotected route. Do not add technical route controls to the usual account enrollment procedure.

### Refresher — accepted

**Purpose:** Show the actual directory visibility of managed generators. Let the user control Refresher without operating each Refresh manually.

**Main view**

1. Show three measured counts in this sequence: **Top 50**, **Top 100**, **Full list**. These are counts of user-owned generators in the displayed directory. Show the time of the last satisfactory directory observation. Use the displayed sequence, with Perchance filters and pinned entries.
2. Show **Active**, **Sleep**, and **Available Active** counts. Available Active means public, Active, and safe to Refresh. A generator can be Active but not available because another task or manual edit prevents Refresh.
3. Show whether Refresher is **Running**, **Paused**, or needs attention. Give **Pause Refresher** and **Resume Refresher** controls. These controls affect only Refresher. They must not override **Pause PCMS**.
4. Show the mandatory **Active / Sleep** cycle and its current durations. The defaults are **24 hours Active / 72 hours Sleep**. Put the controls to change these durations in the Refresher module settings under Settings.
5. Show a short explanation of the priority sequence: **Top 50 → Top 100 → Full list**. This sequence does not change with the number of Available Active generators.

**Pool list**

1. Let the user search and filter the Refresh Pool. Show the slug, account, Active or Sleep condition, time until the next cycle change, and last measured position in the directory.
2. Distinguish **Not seen** from **Not measured**. Show **Unknown** if a directory observation is not satisfactory. Do not show an estimated position as a measured value.
3. Show if a generator is held by Deployer, a manual edit, or a route problem. Open the correct generator or affected job for details.
4. Select a generator to see its recent Refresh results, cycle times, and last measured position. Show a completed source save and a measured directory position as different results.
5. Keep the list usable with 1,000 or more generators. Do not show a large set of technical data by default.

**Operation rules**

- Refresher selects and repeats Refresh operations automatically. The user must not select each generator or start each Refresh manually.
- The scheduler can Refresh several Available Active generators. It must use the fixed priority sequence and adjust work to the available pool, as specified in Section 5.5.
- Pausing Refresher stops new Refresh operations and keeps unfinished work. Active time stops while Refresher is paused. Sleep time continues. Resume must examine current conditions before new source writes.
- Show failed or uncertain Refresh work with the affected generator. Do not fill Home or Refresher with raw logs. Journal keeps the full record.

**Success:** The user can see measured top-50, top-100, and full-list counts, identify available generators, and control Refresher without operating each save.

**Failure:** If PCMS cannot measure the directory, show **Unknown** and the last satisfactory observation time. Do not show a successful source save as proof of directory visibility. Keep other pages available.

**Limits:** Do not Refresh a generator during Sleep, deployment, or a manual source edit. Do not let a module Resume override a global Pause. Do not make the user manage the Refresh sequence by hand.

### Work — accepted

**Purpose:** Show the work of PCMS modules in one place. Help the user act only when PCMS cannot continue automatically.

**Main view**

1. Show **Needs action** first. Then show **In progress** and **Waiting**. Let the user find **Completed** and earlier work with search and filters.
2. Show the task, affected generator or account, module, and a short status for each job. Show the next necessary user operation only if one exists.
3. For a batch, show the number of completed, active, waiting, and held items. Let the user open each item without losing the batch position.
4. Open a job to show its current step, result, and related generator, account, or GitHub folder. Keep detailed records in Journal.
5. Let the user search and filter jobs by generator, account, module, status, or job ID. Show all matching jobs, with stable paging for large lists. Do not hide later pages behind a fixed result limit.

**Controls and recovery**

- Open the **correct affected item**. Do not send the user to general Settings when an account, generator, or job is known.
- Show the correct operation when user input is necessary. Examples are **Complete login**, **Open editor**, and **Review in Perchance**. Keep the operation with the affected item.
- When AI Helper is ready for user review, show **Review in Perchance** on its Work item. Select it to focus the correct generator tab, under the correct Persona. The user must be able to examine the AI Helper result and click the **PCMS-provided Finish and publish control inside that Perchance editor**. Do not look for a native Perchance button. Do not send the user to Settings or a different generator.
- Show **Waiting for user** until the user completes this step. When PCMS cannot confirm that AI Helper finished, show **Check AI Helper**, not a false completed result.
- A DEVELOP job must keep its generator tab open. If the tab is missing or AI Helper state is lost, show the affected job and a clear recovery step. Do not repeat the prompt or replace the user's work without a check.
- For an error, show a short cause and a useful next step. If PCMS can repair the problem safely, it must do so automatically.
- If the result of a Perchance or GitHub write is unknown, show **Unknown**. PCMS must examine the result before it repeats the operation. Do not give a button that starts an uncertain operation again.
- Show **Paused** when PCMS is paused. Work must not start new module jobs during a global Pause. Module controls must not override this rule.
- Keep job records and user input after Firefox closes or a module updates. Continue safe work automatically after Resume or startup.

**Success:** The user can see active work and find tasks that require user input. The user can open the correct item, including the active Perchance AI Helper tab, and continue the task without technical procedures.

**Failure:** Show the actual job condition. Keep other jobs available. Do not show an unfinished or uncertain job as completed.

**Limits:** Work is a view of the shared core queue. It is not a second job system. Do not make the user start each automatic step manually. Do not duplicate Journal or add a technical control panel.

### Other — accepted

**Purpose:** Open installed modules that do not have an entry in primary navigation. Do not make the user find module operations in Settings.

**Module list**

1. Show a short list of enabled modules that have a page and are not in primary navigation. Show the module name and a short description.
2. Select a module to open its page. If the module has more than one page, show its secondary menu. This menu is for that module only.
3. Let the user search for a module when the list is long. Keep the list simple. Do not show code, logs, or configuration by default.
4. Do not add a second entry for a module that the user put in primary navigation. Open the same module page from its primary entry.
5. Modules without a user page do not need an entry in Other. Their status and controls remain in Settings.

**Module access**

- Install, update, enable, disable, and select primary navigation entries in **Settings**, not in Other.
- A disabled module must not operate. Do not show a button that cannot open it. Keep the module available in Settings so the user can enable it.
- When a module needs attention, show the affected task in Work. Open the correct module page or item when it is necessary. Do not send the user to Settings unless a setting must change.
- When the user adds or updates a module, show its correct page without a PCMS reinstall. Keep the module settings and unfinished work, as specified in Section 4.

**Success:** The user can find and open an installed module without technical steps. A new module does not make primary navigation longer unless the user selects it in Settings.

**Failure:** If a module cannot start or its page cannot load, show a short error and a useful recovery step. Keep other modules available.

**Limits:** Other is not a second dashboard, module store, or settings page. Do not make new global menus for module pages.

### Settings — accepted

**Purpose:** Keep PCMS settings in one place. Let the user change a setting without a technical procedure. Keep usual account and generator work on their own pages.

**Main view**

1. Show a short list: **Connections**, **Modules**, **Refresher**, **Journal**, **Backup**, and **Advanced**. Open the selected section without a second dashboard.
2. Show the current setting and a short status. Show more information only when it is necessary. Save a change and show if it succeeded.
3. Let the user return to the Settings list without loss of input. Search settings by name when necessary.

**Settings sections**

- **Connections:** Set the GitHub repository, branch `main`, and access token. Show connection status and **Reconnect** when necessary. Do not make the user repeat setup for each operation. Keep Persona and route recovery with the affected account in Accounts. Show bridge information here only when manual setup or repair is necessary.
- **Modules:** Show each installed module, its version, and its status. Give **Install**, **Update**, **Enable**, and **Disable** controls. Let the user select **Show in primary navigation** for each module with a page. A new module with a page appears in Other unless the user selects this setting. Keep its settings and unfinished jobs during updates.
- **Refresher:** Change the default Active and Sleep durations, and other necessary Refresher settings. Show the current values. Keep live visibility and operational controls on the Refresher page.
- **Journal:** Search and filter all recorded PCMS work. Show the automatic disk export setting, the last export result, and **Export now**. Let the user open or export detailed debugging records. Do not show secrets in Journal.
- **Backup:** Show the automatic disk backup setting, destination, and last backup result. Give **Back up now** and **Restore**. Show which data is in a backup and report missing data. Backups include tokens, cookies, sessions, Personas, and other PCMS data. Show a short notice that exported files are not encrypted. Do not require a password.
- **Advanced:** Show technical diagnostics and recovery tools only when necessary. Do not place usual work, login, source review, or publication controls here.

**Operation rules**

- Keep each module's settings together in Settings. Other opens module pages for usual work.
- Do not make a second settings interface inside a module if the same setting is already here.
- Show a useful error with the setting that failed. Keep user input. Open the correct account, generator, or Work item when the error belongs there.
- Keep **Pause PCMS** and **Resume PCMS** accessible outside Settings. Settings must not override a global Pause.
- Keep Journal recording and automatic Journal and Backup exports available while PCMS is paused, as specified in Section 4.

**Success:** The user can find and change a setting, install or update a module, examine Journal, and make or restore a Backup without a second UI.

**Failure:** Show the affected setting and the next necessary step. Do not report a completed export or restore without a satisfactory result. Keep unaffected settings available.

**Limits:** Do not add technical setup steps to usual work. Do not duplicate Accounts, Generators, Refresher, or Work in Settings. Do not display tokens, cookies, or session secrets in Journal or on the normal Settings page.

**Defaults:** Journal exports every 30 minutes. Keep automatic Journal exports and local records for 90 days. Backup runs every 6 hours. Keep automatic backups for 90 days. Never remove manual exports automatically. See Sections 5.6 and 5.7.

**Open:** Verify automatic file access and cleanup in the installed Firefox extension.

### Module interface — accepted

**Purpose:** Open a module's user page when it is necessary. Keep the page small and easy to use.

**Module page**

1. Show the module name, a short status, and the next necessary operation.
2. If the module has more than one page, show a short secondary menu for that module only.
3. Put operations with the related account, generator, or job when possible. Do not make the user go to a module page to do a small operation.
4. Open a module from **Other** or its selected primary navigation entry. Use the same page in the two cases.
5. Keep module installation, updates, enable and disable controls, and navigation selection in **Settings → Modules**.
6. A module without a user page can operate in the background. Do not show an empty page for it.

**Updates:** When a module changes, update its visible page. Do not keep controls from an earlier version active. Keep user input and unfinished work.

**Success:** The user can open a module and do its task without a second dashboard or technical procedure.

**Failure:** If the module page cannot open, show a short cause and **Open Modules** to go to its Settings entry. Keep other modules available.

**Limits:** Do not add a second global menu, a second work queue, or duplicate settings.

### Interaction and errors — accepted

**Purpose:** Let the user do a task and see its actual result. Show the next necessary step when a task cannot continue.

**Operations**

1. Put each control with the account, generator, module, or job that it changes. Use a label that tells the user what the control does.
2. After a click, show that PCMS received the operation. Show **In progress**, **Waiting for you**, **Complete**, **Failed**, or **Unknown**, as applicable. Do not show **Complete** before PCMS makes sure that the result is correct.
3. Do not start the same operation again because the user clicks twice, a page reloads, or an answer from Perchance is missing. Keep the job and examine the result before a second attempt.
4. Keep form input, list selection, filters, and scroll position when the page changes or an operation fails.
5. Do not make the user complete routine internal steps. When user input is necessary, give one clear next operation with the affected item. For example, **Review in Perchance** must open the correct generator tab and AI Helper chat.

**Search and errors**

1. Search accounts, generators, jobs, and GitHub folders. Open the selected result in its correct page. Do not limit search to only one type of item.
2. Show a short error at the affected item. Tell the user what stopped, what PCMS tried, and what the user can do next. Do not send the user to unrelated Settings or Diagnostics pages.
3. Group reports that have the same cause. Keep a problem visible until PCMS makes sure that it is resolved. A user can mark it as reviewed without marking it as resolved.
4. If PCMS cannot determine the result, show **Unknown**. Keep the operation safe. Do not show success, silently retry, or hide the problem.
5. Keep technical details in Journal or an optional details view. Do not show tokens, cookies, or session secrets in normal UI messages.

**Display rules**

- Keep names, status text, focus, and controls consistent on all pages. Make all operations accessible with the keyboard and usable in a narrow window.
- Show actual Refresher directory positions separately from successful source saves.
- Journal and Backup must continue their automatic work without an open dashboard, including when PCMS is paused.

**Success:** The user can find an item, do its task, see the result, and correct a problem in the normal PCMS interface. Each visible control must operate in the installed extension.

**Failure:** Keep the affected job and user input. Show a clear recovery operation when one is possible. Work on other items must continue.

**Limits:** Do not add a second UI, a second work queue, or a technical procedure for usual work. Do not show an unverified result as complete.

## 7. Development

**Status:** Accepted.

**Purpose:** Build a reliable PCMS with the minimum necessary development procedure. Tests and CI must improve the product. They must not become the purpose of development.

### Repository preparation

1. Read this client specification before development. Write `design.md` and `PHASES.md` from the accepted requirements. Keep both documents short and useful.
2. Keep `AGENTS.md` short. It must tell agents where to find the requirements, design, phase plan, and current work. Do not repeat these documents in `AGENTS.md`.
3. Keep `todo.md` for the active phase. List the necessary tasks, completed work, tests, and remaining work. Update it as work proceeds. Record only important, non-obvious information. If a note is long, put it in a separate Markdown file and link to it from `todo.md`.
4. Keep `memory.md` for short, useful project context that can help the next agent. It is not a source of requirements.
5. Keep `learned.md` for mistakes, unexpected problems, and useful lessons. At project completion, extract reusable lessons for the knowledge base. Do not add entries without useful information.
6. Keep one short `CI-GUIDELINES.md` file. Agents must read it before they make or change CI. It must explain how to select tests, keep CI fast, and protect important behavior.

### Phases and agent control

1. Divide development into **small phases**. Each phase must have one clear result and the tests necessary to examine that result. Keep dependencies clear.
2. Work on **one phase at a time**. Finish or record the current phase before the next phase starts.
3. The **agent task prompt** must tell the agent if it must stop after one phase or continue through subsequent phases. Do not put this stop-or-continue decision in `AGENTS.md`.
4. At the start of a phase, read the current repository and `todo.md`. Continue unfinished work before starting new work.
5. Commit and push code and `todo.md` to **GitHub frequently**. Do not keep the only useful checkpoint on the local computer. Keep commits small enough for another agent to continue work.
6. After an interruption, use the latest GitHub checkpoint and `todo.md`. Do not repeat completed work or restart the phase without a reason.
7. Do not add extra approvals, review procedures, or documentation steps unless they improve reliability or prevent a known risk.

### Tests and CI

1. Write code and run tests that can find real defects. Test boundaries, errors, restart behavior, shared data, and important user tasks where they can fail.
2. Use automated tests and realistic browser tests when they can prove the required behavior. A test of an internal function alone does not prove that the visible PCMS task is complete.
3. Keep **commit checks fast**. Run tests related to the changed code and a small set of critical checks. Do not run every historical test after every commit.
4. Run broader integration and package tests at suitable **phase or release checkpoints**. Keep essential protection tests when a change can affect accounts, routes, source, or stored work.
5. Design CI to give useful failure results quickly. Avoid duplicate tests and long sequences of tests that do not depend on one another.
6. Use the repository CI guidelines whenever CI is made or changed. Do not weaken a necessary test only to make CI pass.
7. Keep the public GitHub repository and CI free of credentials, tokens, cookies, and live account sessions.

### Live testing and completion

1. Do as much verification as possible with code tests, simulated services, and installed-Firefox tests before live Perchance testing.
2. Plan live tests for the **latest safe phase** when a test cannot be done earlier or would require sensitive access. A missing live test does not stop subsequent coding phases when this plan permits deferral.
3. Record deferred live checks as **Not tested**. Never describe a simulated result as a live Perchance result.
4. Do a live test earlier if that is necessary to prevent later work from depending on an unproven result. Do not let an agent skip a test that the phase plan requires.
5. A phase is complete only when its required code and applicable tests are complete. Record any deferred live verification. A working backend without the required UI is not a completed user task.
6. For the first DEVELOP integration, make **one focused, half-manual userscript test** of writing and verifying the three `src/` files, starting a new chat, and sending the exact `prompt.md` once. The user handles necessary live login, review, and intervention. Record detailed, time-ordered diagnostic events in durable storage so the recorded log remains available after the tab or Firefox closes and reopens; continue logging on restart. Include step, generator/job identity, observed response, errors, and uncertainty without recording credentials or session secrets. Do not rely on the DevTools console alone. Test the actual PCMS **Finish and publish** handoff later with the Deployer UI. Do not build or test a whole AI Helper conversation backup or AI worker replacement.

**Limits:** Do not use tests, CI, reviews, or documentation as a substitute for a working application. Do not change the accepted client requirements to make development easier. Do not perform unapproved live actions on real accounts or generators.
