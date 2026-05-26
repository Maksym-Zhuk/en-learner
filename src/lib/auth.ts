import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { JwtPayload } from './types'

export const COOKIE_NAME = 'auth_token'
export const USER_INFO_COOKIE = 'user_info'
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}
const JWT_SECRET: string = process.env.JWT_SECRET

export function signToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

export function getUser(request: NextRequest): JwtPayload | null {
  // Try cookie first
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value
  if (cookieToken) {
    return verifyToken(cookieToken)
  }

  // Try Authorization header
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return verifyToken(token)
  }

  return null
}
