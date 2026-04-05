export function isDevLoginEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production') {
    return false;
  }

  const rawValue = `${env.IDEAL_STAY_ENABLE_DEV_LOGIN ?? ''}`.trim().toLowerCase();
  return rawValue === 'true' || rawValue === '1' || rawValue === 'yes';
}
