"use client";

import { UserApiKeyManager } from "@/components/settings/UserApiKeyManager";

export default function ApiKeysSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">API Keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate and manage personal API keys for external integrations and AI
          agents. Keys have the same privileges as your account.
        </p>
      </div>
      <UserApiKeyManager />
    </div>
  );
}
