export function demoRecapHref(profileId: string) {
  return `#/recap-demo?persona=${profileId === 'maya' ? 'maya' : 'alex'}`;
}
