import { cache } from 'react'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'

export const getUser = cache(getCurrentUser)
