import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://pingcompany.github.io",
  base: "/Platform/",
  integrations: [
    starlight({
      title: "PING Docs",
      customCss: ["./src/styles/custom.css"],
      logo: {
        src: "./src/assets/ping-logo.svg",
        replacesTitle: false,
      },
      sidebar: [
        { label: "Home", link: "/" },
        {
          label: "Getting Started",
          autogenerate: { directory: "getting-started" },
        },
        {
          label: "Architecture",
          autogenerate: { directory: "architecture" },
        },
        {
          label: "Guides",
          autogenerate: { directory: "guides" },
        },
        {
          label: "API Reference",
          autogenerate: { directory: "api-reference" },
        },
        {
          label: "Contributing",
          autogenerate: { directory: "contributing" },
        },
      ],
    }),
  ],
});
