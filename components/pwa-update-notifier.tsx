'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function PWAUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New service worker has taken control
        window.location.reload()
      })

      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                setUpdateAvailable(true)
                toast.info('New version available!', {
                  description: 'Click to update the app',
                  action: {
                    label: 'Update',
                    onClick: () => {
                      newWorker.postMessage({ type: 'SKIP_WAITING' })
                    },
                  },
                })
              }
            })
          }
        })
      })
    }
  }, [])

  const handleUpdate = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
    }
  }

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button onClick={handleUpdate} variant="default" size="sm">
        Update Available
      </Button>
    </div>
  )
}
