export function dataSource(): 'mock' | 'postgres' {
  const value = process.env.DATA_SOURCE;
  if (value !== 'mock' && value !== 'postgres')
    throw new Error('DATA_SOURCE must be explicitly set to mock or postgres.');
  if (process.env.NODE_ENV === 'production' && value !== 'postgres')
    throw new Error('Production requires DATA_SOURCE=postgres.');
  return value;
}
export function timeZone() {
  return process.env.APP_TIME_ZONE || 'Asia/Bangkok';
}
