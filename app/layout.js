import "@/app/globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";

export const metadata = {
  title: "GitBot — Event-Driven GitHub Automation",
  description:
    "Automate your GitHub workflow with configurable rules. React to issues, pull requests, and pushes with labels, comments, and Slack notifications.",
  keywords: "GitHub, automation, bot, webhooks, CI/CD, Slack",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
