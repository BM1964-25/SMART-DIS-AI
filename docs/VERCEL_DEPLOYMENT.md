# Vercel Deployment

SMART DIS-AI wird aus GitHub nach Vercel deployed.

## GitHub Repository

```text
https://github.com/BM1964-25/SMART-DIS-AI
```

## Import in Vercel

1. Vercel öffnen.
2. `Add New` → `Project` wählen.
3. GitHub Repository `BM1964-25/SMART-DIS-AI` importieren.
4. Framework Preset: `Next.js`.
5. Build Command: `npm run build`.
6. Install Command: `npm install`.
7. Root Directory leer lassen, weil die App im Repository-Root liegt.

## Environment Variables

Für den aktuellen lokalen MVP-Modus sind keine Supabase-Secrets erforderlich.

Für den produktiven Supabase-/OpenAI-Betrieb später in Vercel setzen:

```text
NEXT_PUBLIC_APP_URL=https://<vercel-domain>
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_DOCUMENTS_BUCKET=documents
BUILTSMART_BOOTSTRAP_ORGANIZATION_ID=...
OPENAI_API_KEY=...
APP_RATE_LIMIT_REQUESTS_PER_MINUTE=60
ENABLE_LOCAL_FOLDER_IMPORT=false
```

## Lokaler Ordnerzugriff

Lokaler Ordnerzugriff ist auf Vercel bewusst deaktiviert.

Grund:

- Vercel läuft serverseitig in einer Cloud-Umgebung.
- Browser und Cloud-Server dürfen nicht frei auf lokale Finder-Ordner zugreifen.
- Lokale Ordner bleiben ein lokaler MVP-/Desktop-Connector-Use-Case.

Produktiv werden Dateien über Upload, Supabase Storage oder spätere Connectoren wie SharePoint, OneDrive und Outlook verarbeitet.

## Build Check

Vor jedem Deployment lokal ausführen:

```bash
npm run format:check
npm run typecheck
npm run lint
npm run build
```

## Vercel CLI

Falls das Projekt lokal mit Vercel verknüpft werden soll:

```bash
npx vercel login
npx vercel link
npx vercel --prod
```

Wenn der Login per Device Code startet, den angezeigten Link im Browser öffnen und bestätigen.
