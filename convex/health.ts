import { query } from './_generated/server'

export const status = query({
  args: {},
  handler: async () => {
    return {
      ok: true,
      message: 'Convex backend is running.',
      now: new Date().toISOString(),
    }
  },
})
