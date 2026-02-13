
import GlobalLoading from "@/components/GlobalLoading";
import Loading from "@/components/Loading";
import { Toaster } from "@/components/ui/toaster";
import localFont from "next/font/local";
import React, { Suspense } from "react";
import { AuthProvider } from "./authContext";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "Stockly - Inventory Management System",
  description:
    "Stockly is a modern Next.js web application for efficient product inventory management. Features include product listing, filtering, sorting, secure authentication, and responsive design.",
  authors: [
    {
      name: "Arnob Mahmud",
      url: "https://arnob-mahmud.vercel.app/",
      email: "arnob_t78@yahoo.com",
    },
  ],
  keywords: [
    "Stockly",
    "Inventory Management",
    "Next.js",
    "React",
    "Prisma",
    "MongoDB",
    "Product Listing",
    "Authentication",
    "JWT",
    "CRUD",
    "Responsive Web App",
    "Arnob Mahmud",
  ],
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
    other: [
      { rel: "icon", url: "/favicon.ico" },
    ],
  },
  openGraph: {
    title: "Stockly - Inventory Management System",
    description:
      "Efficiently manage your product inventory with Stockly, a secure and responsive Next.js web application.",
    url: "https://stockly-inventory.vercel.app/",
    images: [
      {
        url: "https://github.com/user-attachments/assets/7495dcfb-c7cb-44e6-a1ef-d82930a8ada7",
        width: 1200,
        height: 630,
        alt: "Stockly Screenshot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stockly - Inventory Management System",
    description:
      "Efficiently manage your product inventory with Stockly, a secure and responsive Next.js web application.",
    images: [
      "https://github.com/user-attachments/assets/7495dcfb-c7cb-44e6-a1ef-d82930a8ada7",
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Suspense fallback={<Loading />}>
              <GlobalLoading />
            </Suspense>
            <Suspense fallback={<Loading />}>
              {children}
            </Suspense>
          </ThemeProvider>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
