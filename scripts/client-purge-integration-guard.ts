type DestructivePurgeEnvironment = Readonly<Record<string, string | undefined>>;

export function assertDestructivePurgeRunsInGithubActions(
  environment: DestructivePurgeEnvironment,
) {
  if (
    environment.CI !== 'true' ||
    environment.GITHUB_ACTIONS !== 'true' ||
    environment.MONALYZ_ALLOW_DESTRUCTIVE_LOCAL_PURGE_TEST !== '1'
  ) {
    throw new Error('DESTRUCTIVE_LOCAL_PURGE_TEST_GUARD_REQUIRED');
  }
}
