import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { PWAUpdateNotifier } from '@/components/pwa-update-notifier'

export const metadata: Metadata = {
  title: 'Yuno HabitTrack',
  description: 'Track your habits and goals with Yuno',
  generator: 'v0.dev',
  manifest: '/manifest.json',
  themeColor: '#000000',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Yuno HabitTrack',
  },
  icons: {
    icon: [
      { url: '/yuno512.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/yuno512.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
        {/* Favicon and PWA Icons */}
        <link rel="icon" type="image/svg+xml" href="/yuno512.svg" />
        <link rel="apple-touch-icon" href="/yuno512.svg" />
        <link rel="shortcut icon" href="/yuno512.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body>
        {children}
        <PWAUpdateNotifier />
      </body>
    </html>
  )
}
