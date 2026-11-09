import { createApp } from './app';
import { loadEnv } from './config/env';

const env = loadEnv();
createApp().listen(env.PORT, () => {
  console.log(`TMC-AACS API listening on port ${env.PORT}`);
});
