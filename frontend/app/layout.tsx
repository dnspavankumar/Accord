import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../src/index.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Accord - AP2 & Razorpay AI Agent Gateway',
  description:
    'Open protocol bridge and policy-gated payment gateway for AI buyer agents using AP2 and Razorpay.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter?.variable || ''} bg-[#fafafa]`}
    >
      <body className="bg-[#fafafa] text-zinc-900 antialiased font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
