import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Space_Grotesk, IBM_Plex_Mono, Hanken_Grotesk } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { isClerkEnabled } from '@/lib/clerk-config'
import { clerkAppearance } from '@/lib/clerk-appearance'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const hankenGrotesk = Hanken_Grotesk({
  variable: '--font-hanken-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Continuity — Bench Diagnostic Instrument',
  description:
    'A bench diagnostic instrument that traces board faults to a single refdes, with every citation verified against the electrical graph.',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Clerk's current Next 16 guidance: <ClerkProvider> sits INSIDE <body>, not
  // wrapping <html>. We still only mount it when keys are present, so the
  // no-auth scripted demo runs untouched with zero Clerk configuration.
  const body = (
    <>
      {children}
      {process.env.NODE_ENV === 'production' && <Analytics />}
    </>
  )

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${hankenGrotesk.variable} ${ibmPlexMono.variable} bg-chassis`}
    >
      <body className="font-sans antialiased">
        {isClerkEnabled() ? (
          <ClerkProvider appearance={clerkAppearance}>{body}</ClerkProvider>
        ) : (
          body
        )}
      </body>
    </html>
  )
}
