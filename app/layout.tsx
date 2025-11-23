import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from './components/Navbar';
import Chatbot from './components/Chatbot';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Guitar Hero Chord App",
  description: "Real-time chord display for guitar players",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
      >
        <Providers>
          <div className="flex min-h-full flex-col">
            <Navbar />
            <main className="flex-1">
              <div className="container py-8">
                {children}
              </div>
            </main>
            <Chatbot />
          </div>
        </Providers>
      </body>
    </html>
  );
}