import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/libs/config/fontawesome";
import {
  SHOWCASE_BRAND,
  SHOWCASE_LINKS,
  buildShowcaseColorCss,
} from "@/libs/config/showcase.config";
import { ConditionalShell } from "@/modules/app/ConditionalShell";
import { GoogleAnalytics } from "@/modules/app/GoogleAnalytics";

/* =========================================================
   FONTS
========================================================= */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* =========================================================
   SITE CONFIG (PRODUCT POSITIONING)
========================================================= */

const SITE_NAME = SHOWCASE_BRAND.name;
const SITE_TITLE = `${SHOWCASE_BRAND.name} — ${SHOWCASE_BRAND.tagline}`;
const SITE_DESCRIPTION = SHOWCASE_BRAND.description;
const SITE_URL = SHOWCASE_LINKS.siteUrl;

const SITE_KEYWORDS = [
  "React UI components",
  "Next.js design system",
  "component library",
  "UI kit",
  "frontend system",
  "design system",
  "Next.js UI",
];

/* =========================================================
   METADATA (FULL SEO)
========================================================= */

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },

  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,

  authors: [
    {
      name: SHOWCASE_LINKS.author.name,
      url: SHOWCASE_LINKS.author.url,
    },
  ],

  creator: SHOWCASE_LINKS.author.name,
  publisher: SITE_NAME,

  keywords: SITE_KEYWORDS,
  category: "technology",

  alternates: {
    canonical: SITE_URL,
  },

  icons: {
    // SVG first: it is the generated source (brand/build.mjs) and the only one
    // that stays sharp. The .ico is the fallback for browsers that ignore it.
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
    other: [{ rel: "manifest", url: "/site.webmanifest" }],
  },

  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} Preview`,
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

/* =========================================================
   STRUCTURED DATA (SEO POWER)
========================================================= */

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
    },

    {
      "@type": "Person",
      name: SHOWCASE_LINKS.author.name,
      url: SHOWCASE_LINKS.author.url,
    },

    {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },

    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      creator: {
        "@type": "Person",
        name: SHOWCASE_LINKS.author.name,
      },
    },
  ],
};

/* =========================================================
   ROOT LAYOUT
========================================================= */

const colorOverrideCss = buildShowcaseColorCss();

const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {colorOverrideCss && (
          <style
            id="showcase-color-overrides"
            dangerouslySetInnerHTML={{ __html: colorOverrideCss }}
          />
        )}

        {/* APP SHELL (OPTIONAL) */}
        <main className="flex-1">
          <ConditionalShell>{children}</ConditionalShell>
        </main>

        {/* STRUCTURED DATA */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />

        {/* GOOGLE ANALYTICS */}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
