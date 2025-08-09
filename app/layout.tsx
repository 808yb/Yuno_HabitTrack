import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { PWAUpdateNotifier } from '@/components/pwa-update-notifier'
import { ThemeProvider } from '@/components/theme-provider'

export const metadata: Metadata = {
  title: 'Yuno HabitTrack',
  description: 'Track your habits and goals with Yuno',
  generator: 'v0.dev',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Yuno',
  },
  icons: {
    icon: [
      { url: '/yuno512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/yuno180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isProd = process.env.NODE_ENV === 'production'
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
        {/* Favicon and PWA Icons */}
        <meta name="apple-mobile-web-app-title" content="Yuno" />
        <meta name="application-name" content="Yuno" />
        <link rel="icon" type="image/png" href="/yuno512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/yuno180.png" />
        {/* Extra iOS compatibility: a version without sizes */}
        <link rel="apple-touch-icon" href="/yuno180.png" />
        <link rel="shortcut icon" type="image/png" href="/yuno512.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                var isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname);
                if (isLocalhost) {
                  if (!sessionStorage.getItem('sw-cleaned')) {
                    navigator.serviceWorker.getRegistrations()
                      .then(function(registrations) {
                        return Promise.all(registrations.map(function(reg) { return reg.unregister(); }));
                      })
                      .catch(function() { /* ignore */ })
                      .finally(function() {
                        if (window.caches && caches.keys) {
                          caches.keys().then(function(keys) {
                            return Promise.all(keys.map(function(key) { return caches.delete(key); }));
                          }).finally(function() {
                            try { sessionStorage.setItem('sw-cleaned', '1'); } catch (e) {}
                            location.reload();
                          });
                          return;
                        }
                        try { sessionStorage.setItem('sw-cleaned', '1'); } catch (e) {}
                        location.reload();
                      });
                  }
                } else {
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
              }
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <PWAUpdateNotifier />
        </ThemeProvider>
      </body>
    </html>
  )
}
