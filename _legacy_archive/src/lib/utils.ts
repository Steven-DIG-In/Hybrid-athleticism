import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg`
}

export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`
}

export function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  if (hours === 0) return `${remainingMins}m`
  return `${hours}h ${remainingMins}m`
}

export function formatPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm)
  const secs = Math.round((minPerKm - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')} /km`
}

export function calculateE1RM(weight: number, reps: number, rir: number = 0): number {
  // Epley formula adjusted for RIR
  return weight * (1 + (reps + rir) / 30)
}

export function rirToRpe(rir: number): number {
  return 10 - rir
}

export function rpeToRir(rpe: number): number {
  return 10 - rpe
}
