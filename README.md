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

The login flow requests these delegated scopes:

- `openid`
- `profile`
- `email`
- `User.Read`

### 2. Configure the Graph app

The backend calls Microsoft Graph to:

- read users
- read groups and group members
- read subscribed SKUs / licenses
- add and remove group members
- assign and remove licenses

Grant the Graph application permissions your tenant requires for those actions, then grant admin consent. In most tenants this means reviewing permissions in the area of:

- user read access
- group read and membership write access
- license read and assignment write access

### Recommended Microsoft Graph application permissions

These are the permissions that best match the API calls in this codebase:

| Permission | Why this app needs it |
| --- | --- |
| `User.Read.All` | List users from `/users` and read user properties used throughout the UI. |
| `GroupMember.Read.All` | List groups and read group members. |
| `GroupMember.ReadWrite.All` | Add and remove users from groups. |
| `LicenseAssignment.Read.All` | List subscribed SKUs from `/subscribedSkus`. |
| `LicenseAssignment.ReadWrite.All` | Assign and remove licenses with `/users/{id}/assignLicense`. |

### Why these permissions map to this app

- `GET /users` requires application permission `User.Read.All` at minimum.
- `GET /groups` requires application permission `GroupMember.Read.All` at minimum.
- `GET /groups/{id}/members` requires `GroupMember.Read.All`; because this app reads member user properties such as display name, mail, and UPN, `User.Read.All` is also appropriate.
- `GET /subscribedSkus` requires `LicenseAssignment.Read.All` at minimum.
- `POST /users/{id}/assignLicense` requires `LicenseAssignment.ReadWrite.All` at minimum.
- `POST /groups/{id}/members/$ref` and `DELETE /groups/{id}/members/{id}/$ref` require `GroupMember.ReadWrite.All` at minimum for user members.

### Optional broader permissions

If your tenant prefers broader permissions over a minimal set, these higher-privilege permissions can also satisfy several reads:

- `Directory.Read.All`
- `Directory.ReadWrite.All`
- `Group.Read.All`
- `Group.ReadWrite.All`
- `Organization.Read.All`

Use them only if your tenant policy or admin workflow requires them. The table above is the closer least-privilege fit for this repo.

### Important limitations

- Role-assignable groups need extra permission and role setup beyond this app's default recommendation. Microsoft documents `RoleManagement.ReadWrite.Directory` as an additional requirement for those cases.
- Dynamic membership groups can't have members removed through the standard group member delete API.
- Group member reads can return limited data if the app lacks permission to read the underlying object type. This repo reads user properties from group membership responses, which is why `User.Read.All` is included above.

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

## Microsoft Docs

- List users: https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0
- List groups: https://learn.microsoft.com/en-us/graph/api/group-list?view=graph-rest-1.0
- List group members: https://learn.microsoft.com/en-us/graph/api/group-list-members?view=graph-rest-1.0
- List subscribed SKUs: https://learn.microsoft.com/en-us/graph/api/subscribedsku-list?view=graph-rest-1.0
- Assign or remove user licenses: https://learn.microsoft.com/en-us/graph/api/user-assignlicense?view=graph-rest-1.0
- Add group members: https://learn.microsoft.com/en-us/graph/api/group-post-members?view=graph-rest-1.0
- Remove group members: https://learn.microsoft.com/en-us/graph/api/group-delete-members?view=graph-rest-1.0
