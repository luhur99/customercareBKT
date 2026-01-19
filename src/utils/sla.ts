export const getSlaStatus = (createdAt: string, resolvedAt: string | null, status: string): 'green' | 'yellow' | 'red' => {
  const creationTime = new Date(createdAt).getTime();
  const currentTime = Date.now();
  const twentyFourHoursInMillis = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik
  const nineteenHoursInMillis = 19 * 60 * 60 * 1000; // 19 jam dalam milidetik

  // Jika tiket sudah diselesaikan atau ditutup
  if (resolvedAt && (status === 'resolved' || status === 'closed')) {
    const resolutionTime = new Date(resolvedAt).getTime();
    if (resolutionTime - creationTime <= twentyFourHoursInMillis) {
      return 'green'; // Diselesaikan dalam 24 jam
    } else {
      return 'red'; // Diselesaikan setelah 24 jam
    }
  }

  // Jika tiket masih terbuka atau dalam proses
  const timeElapsed = currentTime - creationTime;

  if (timeElapsed <= nineteenHoursInMillis) {
    return 'green'; // Masih dalam batas waktu hijau (kurang dari 19 jam)
  } else if (timeElapsed > nineteenHoursInMillis && timeElapsed <= twentyFourHoursInMillis) {
    return 'yellow'; // Mendekati batas waktu (antara 19 dan 24 jam)
  } else {
    return 'red'; // Melebihi batas waktu (lebih dari 24 jam)
  }
};