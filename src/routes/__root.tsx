import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ConvexProvider, ConvexReactClient } from 'convex/react'

import appCss from '../styles.css?url'

let convexClient: ConvexReactClient | null = null

function getConvexClient() {
  if (typeof window === 'undefined') {
    return null
  }

  if (convexClient) {
    return convexClient
  }

  const convexUrl = import.meta.env.VITE_CONVEX_URL
  if (!convexUrl) {
    return null
  }

  convexClient = new ConvexReactClient(convexUrl)
  return convexClient
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'ManyCards | Lip Read Sprint',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const client = getConvexClient()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {client ? <ConvexProvider client={client}>{children}</ConvexProvider> : children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
