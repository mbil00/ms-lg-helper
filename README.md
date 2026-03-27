# MG - User Management

Internal admin app for managing Microsoft Entra users with Microsoft Graph. It lets approved admins:

- browse and refresh users from Graph
- inspect licenses and groups
- create saved user lists
- run bulk license and group membership actions
- review completed operations and the audit log

The app is built with Next.js, NextAuth/Auth.js, Prisma, and a local SQLite database.

## Prerequisites

- Node.js 20 or 22 LTS
- npm
- A Microsoft Entra ID tenant
- An Entra app registration for admin sign-in
- An Entra app registration with Microsoft Graph access for backend operations

Node 25 produced Prisma engine warnings during local verification, so use Node 20 or 22 unless you have a reason not to.

## Environment Setup

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

Use `.env`, not `.env.local`, because Prisma CLI commands in this repo read from `.env`.

### Required variables

`DATABASE_URL`
- Default local database: `file:./dev.db`

`AZURE_TENANT_ID`
`AZURE_CLIENT_ID`
`AZURE_CLIENT_SECRET`
- Used by the server to call Microsoft Graph with client credentials

`AUTH_SECRET`
- Generate one with:

```bash
npx auth secret
```

`AUTH_TRUST_HOST`
- Keep `true` for local development

`AUTH_MICROSOFT_ENTRA_ID_ID`
`AUTH_MICROSOFT_ENTRA_ID_SECRET`
`AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`
- Used for interactive admin sign-in through Microsoft Entra ID

`ADMIN_UPNS`
- Comma-separated allowlist of admin email addresses / UPNs
- Signing in successfully is not enough; the user also must be listed here

## Azure / Entra Setup

You can use the same app registration for both sign-in and Graph access, or keep them separate.

### 1. Configure the sign-in app

- Add a Web redirect URI for local development:

```text
http://localhost:3000/api/auth/callback/microsoft-entra-id
```

- Put that app's client ID, secret, and tenant ID into:
  - `AUTH_MICROSOFT_ENTRA_ID_ID`
  - `AUTH_MICROSOFT_ENTRA_ID_SECRET`
  - `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`

### 2. Configure the Graph app

The backend calls Microsoft Graph to:

- read users
- read groups and group members
- read subscribed SKUs / licenses
- add and remove group members
- assign and remove licenses

Grant the Graph application permissions your tenant requires for those actions, then grant admin consent. In most tenants this means reviewing permissions in the area of:

- user read access
- group read/write access
- license assignment read/write access
- tenant/subscribed SKU read access

Put that app's tenant ID, client ID, and secret into:

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`

## Install And Run

Install dependencies:

```bash
npm install
```

Apply the existing Prisma migration:

```bash
npx prisma migrate deploy
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

## First Run

1. Sign in with a Microsoft account that is included in `ADMIN_UPNS`.
2. Open the **Users** page and click **Refresh from Graph** to populate the local cache.
3. Create one or more lists from selected users.
4. Use **Actions** to run a dry run before executing bulk changes.
5. Review results in **Actions** and **Audit Log**.

There is no seed script in this repo. User, group, and license data is pulled from Microsoft Graph on demand.

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Database Notes

- Prisma schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations`
- Default local database file: `dev.db`

To check migration state:

```bash
npx prisma migrate status
```
