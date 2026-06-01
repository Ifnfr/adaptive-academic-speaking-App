import { spawn, execSync } from 'child_process';
import http from 'http';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isReady() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000', (res) => {
      // Any response code indicates Next dev server is up
      resolve(res.statusCode >= 200 && res.statusCode < 500);
      res.resume();
    });
    req.on('error', () => {
      resolve(false);
    });
    req.end();
  });
}

async function main() {
  const isWin = process.platform === 'win32';
  
  // Spawn Next.js dev server
  const nextBin = './node_modules/next/dist/bin/next';
  const devServer = spawn('node', [nextBin, 'dev'], {
    stdio: 'ignore',
    detached: !isWin,
  });

  let killed = false;
  const killDevServer = () => {
    if (killed) return;
    killed = true;
    try {
      if (isWin) {
        execSync(`taskkill /pid ${devServer.pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(-devServer.pid, 'SIGKILL');
      }
    } catch {
      // Ignore if already dead
    }
  };

  process.on('SIGINT', () => {
    killDevServer();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    killDevServer();
    process.exit(143);
  });
  process.on('exit', () => {
    killDevServer();
  });

  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (await isReady()) {
      ready = true;
      break;
    }
    await wait(1000);
  }

  if (!ready) {
    console.error('Error: Next dev server did not become ready in 120 seconds');
    killDevServer();
    process.exit(1);
  }

  console.log('Next dev server is ready. Running Playwright tests...');

  // Run Playwright
  const playwrightCmd = isWin ? 'npx.cmd' : 'npx';
  const playwright = spawn(playwrightCmd, ['playwright', 'test'], {
    stdio: 'inherit',
    shell: isWin,
    env: {
      ...process.env,
      PLAYWRIGHT_SKIP_WEB_SERVER: '1',
    },
  });

  playwright.on('close', (code) => {
    killDevServer();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
