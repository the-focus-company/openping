import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://docs.openping.app",
  integrations: [
    starlight({
      title: "OpenPing Docs",
      favicon: "/favicon.ico",
      logo: {
        light: "./src/assets/ping-logo-light.png",
        dark: "./src/assets/ping-logo-dark.png",
        replacesTitle: true,
      },
      customCss: ["./src/styles/custom.css"],
      social: [
        {
          label: "GitHub",
          icon: "github",
          href: "https://github.com/the-focus-company/openping",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Quickstart", slug: "getting-started/quickstart" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Concepts", slug: "getting-started/concepts" },
          ],
        },
        {
          label: "Product Features",
          items: [
            { label: "Copilot Inbox", slug: "features/copilot-inbox" },
            {
              label: "Eisenhower Matrix",
              slug: "features/eisenhower-matrix",
            },
            {
              label: "Channels & DMs",
              slug: "features/channels-and-dms",
            },
            {
              label: "Proactive Alerts",
              slug: "features/proactive-alerts",
            },
            { label: "Knowledge Graph", slug: "features/knowledge-graph" },
            { label: "AI Agents", slug: "features/ai-agents" },
          ],
        },
        {
          label: "Architecture",
          items: [
            { label: "Overview", slug: "architecture/overview" },
            { label: "Tech Stack", slug: "architecture/tech-stack" },
            { label: "Data Model", slug: "architecture/data-model" },
            {
              label: "Authentication",
              slug: "architecture/authentication",
            },
          ],
        },
        {
          label: "API Reference",
          items: [
            { label: "Overview", slug: "api/overview" },
            { label: "Authentication", slug: "api/authentication" },
            { label: "Channels", slug: "api/channels" },
            { label: "Messages", slug: "api/messages" },
            { label: "Direct Messages", slug: "api/direct-messages" },
            { label: "Inbox", slug: "api/inbox" },
            { label: "Users", slug: "api/users" },
            { label: "API Explorer", slug: "api/swagger" },
          ],
        },
        {
          label: "Integrations",
          items: [
            { label: "Overview", slug: "integrations/overview" },
            { label: "GitHub", slug: "integrations/github" },
            { label: "Linear", slug: "integrations/linear" },
            { label: "Webhooks", slug: "integrations/webhooks" },
          ],
        },
        {
          label: "Developer Guide",
          items: [
            { label: "Contributing", slug: "developer-guide/contributing" },
            {
              label: "Local Development",
              slug: "developer-guide/local-development",
            },
            {
              label: "Monorepo Structure",
              slug: "developer-guide/monorepo-structure",
            },
            { label: "Deployment", slug: "developer-guide/deployment" },
          ],
        },
      ],
    }),
  ],
});
