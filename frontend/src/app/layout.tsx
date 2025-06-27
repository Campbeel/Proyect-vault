// Next
import type { Metadata } from "next";
import { headers } from "next/headers";

// Fonts
import { Geist, Geist_Mono } from "next/font/google";

// Styles
import "./globals.css";

// Context Wagmi
import Web3ModalProvider from "./providers/Web3ModalProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Frontend web3 hackathon starter",
  description: "Frontend web3 hackathon starter",
  openGraph: {
    title: "Frontend web3 hackathon starter",
    description: "Frontend web3 hackathon starter",
    url: "https://frontend-web3-hackathon-starter.vercel.app",
    siteName: "Frontend web3 hackathon starter",
    type: "website",
    images: [
      {
        url: "assets/cover.jpg",
        alt: "Frontend web3 hackathon starter",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = headers();
  const cookies = cookieStore.toString();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Web3ModalProvider cookies={cookies}>{children}</Web3ModalProvider>
      </body>
    </html>
  );
}
