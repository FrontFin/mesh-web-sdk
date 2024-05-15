import packageJson from '../../package.json';

const version = packageJson.version;
const platform = 'web';

export const sdkSpecs = {
  platform,
  version,
};