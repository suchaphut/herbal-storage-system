import React from "react"
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Noto_Sans_Thai } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/components/auth/auth-context'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const notoSansThai = Noto_Sans_Thai({ subsets: ['thai'], variable: '--font-noto-sans-thai' })

export const metadata: Metadata = {
  title: 'ระบบติดตามห้องเก็บยาสมุนไพร | Herbal Storage Monitoring',
  description:
    'ระบบติดตามและพยากรณ์แนวโน้มอุณหภูมิและความชื้นในห้องเก็บยาสมุนไพรแบบครบวงจร พร้อม Machine Learning',
  keywords: [
    'IoT',
    'Temperature Monitoring',
    'Humidity Monitoring',
    'Herbal Storage',
    'Machine Learning',
    'ESP32',
  ],
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} ${notoSansThai.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
