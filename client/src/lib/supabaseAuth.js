import { supabase, adminEmail } from './supabase'

// Helpers to centralize Supabase Auth + Admin check logic (client-side)

export const normalizeEmail = (e) => (e || '').trim().toLowerCase()

export const isAdminEmail = (email) => normalizeEmail(email) === normalizeEmail(adminEmail)

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data?.user || null
}

export function onAuthChange(callback) {
  const sub = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null)
  })
  return () => {
    try { sub?.data?.subscription?.unsubscribe?.() } catch {}
  }
}

export async function signInAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  const user = data?.user
  if (!isAdminEmail(user?.email)) {
    // immediately sign out non-admins if they tried to access admin login
    await supabase.auth.signOut()
    throw new Error("Cet utilisateur n'est pas autorisé en tant qu'admin")
  }
  return user
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || !isAdminEmail(user.email)) {
    throw new Error('Admin requis')
  }
  return user
}

export async function signOut() {
  await supabase.auth.signOut()
}

// Convenience namespace
export const auth = {
  supabase,
  adminEmail,
  normalizeEmail,
  isAdminEmail,
  getCurrentUser,
  onAuthChange,
  signInAdmin,
  requireAdmin,
  signOut,
}
