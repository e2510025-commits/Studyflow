// Isolated browser verification server: never point these fixtures at production.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const child = spawn(process.execPath, [fileURLToPath(import.meta.resolve('next/dist/bin/next')), 'dev', '--hostname', '127.0.0.1', '--port', process.env.UI_TEST_PORT || '3000'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'studyflow-ui-test', NEXT_PUBLIC_FIREBASE_API_KEY: 'local-ui-test', NEXT_PUBLIC_FIREBASE_APP_ID: 'local-ui-test', AUTH_SECRET: 'local-ui-test-only' },
});
child.on('exit', (code) => { process.exitCode = code || 0; });
