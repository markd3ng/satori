import type { NextRequest } from 'next/server'
import React from 'react'
import satori from 'satori/standalone'

export const config = {
  runtime: 'experimental-edge',
}

export default async function handler(req: NextRequest) {
  try {
    // 测试 satori 基本功能
    const svg = await satori(
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            background: 'white',
          },
        },
        'Hello Satori'
      ),
      {
        width: 200,
        height: 100,
        fonts: [],
      }
    )

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : ''

    return new Response(
      JSON.stringify({
        error: 'Failed to generate image',
        message,
        stack,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}
