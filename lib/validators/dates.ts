// MEDIUM FIX: Date validation
// Validates date formats and sanity checks

export function isValidDateString(dateString: string): boolean {
  try {
    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date.getTime())
  } catch {
    return false
  }
}

export function isValidBirthDate(dateString: string): boolean {
  if (!isValidDateString(dateString)) {
    return false
  }

  const date = new Date(dateString)
  const now = new Date()

  // Check if date is in the past
  if (date >= now) {
    return false
  }

  // Check if person is at least 18 years old
  const age = now.getFullYear() - date.getFullYear()
  const monthDiff = now.getMonth() - date.getMonth()
  const dayDiff = now.getDate() - date.getDate()

  const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age

  if (actualAge < 18) {
    return false
  }

  // Check if person is not older than 150 years
  if (actualAge > 150) {
    return false
  }

  return true
}

export function isValidTravelDate(dateString: string): boolean {
  if (!isValidDateString(dateString)) {
    return false
  }

  const date = new Date(dateString)
  const now = new Date()

  // Travel date must be in the future
  return date > now
}

export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return false
  }

  const start = new Date(startDate)
  const end = new Date(endDate)

  // End date must be after start date
  return end > start
}
