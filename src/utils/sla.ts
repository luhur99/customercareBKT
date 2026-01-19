export const getSlaStatus = (createdAt: string, resolvedAt: string | null): 'green' | 'red' | 'pending' => {
  const creationTime = new Date(createdAt).getTime();
  
  if (!resolvedAt) {
    // If not resolved, SLA is pending (or could be 'breached' if current time > 24h from creation, but for simplicity, we'll just mark as pending for now)
    return 'pending';
  }

  const resolutionTime = new Date(resolvedAt).getTime();
  const twentyFourHoursInMillis = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  if (resolutionTime - creationTime <= twentyFourHoursInMillis) {
    return 'green'; // Resolved within 24 hours
  } else {
    return 'red'; // Resolved after 24 hours
  }
};