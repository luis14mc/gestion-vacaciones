#!/usr/bin/env node
import { spawn } from 'child_process';
import http from 'http';
import readline from 'readline';
import { promisify } from 'util';
import fs from 'fs';

const sleep = promisify(setTimeout);

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
let devProcess = null;
const captureDir = './skill-captures';

// Ensure capture directory exists
if (!fs.existsSync(captureDir)) {
  fs.mkdirSync(captureDir, { recursive: true });
}

async function checkServerReady() {
  return new Promise((resolve) => {
    http
      .get(`${BASE_URL}/api/health`, { timeout: 2000 }, (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 404);
      })
      .on('error', () => {
        resolve(false);
      });
  });
}

async function waitForServer(maxAttempts = 60) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    if (await checkServerReady()) {
      console.log(`✓ Server ready at ${BASE_URL}`);
      return true;
    }
    attempts++;
    await sleep(1000);
    process.stdout.write('.');
  }
  console.error('✗ Server failed to start');
  return false;
}

async function launchServer() {
  return new Promise((resolve, reject) => {
    devProcess = spawn('pnpm', ['dev'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let serverReady = false;

    const onData = (data) => {
      const output = data.toString();
      if (output.includes('ready - started server on') || output.includes('compiled client')) {
        serverReady = true;
      }
      process.stdout.write(output);
    };

    devProcess.stdout.on('data', onData);
    devProcess.stderr.on('data', onData);

    devProcess.on('error', reject);

    // Wait for server to be ready or 30 seconds
    let readyCheck = setInterval(async () => {
      if (serverReady || (await checkServerReady())) {
        clearInterval(readyCheck);
        resolve(true);
      }
    }, 500);

    setTimeout(() => {
      clearInterval(readyCheck);
      if (!serverReady) {
        waitForServer().then((ready) => {
          if (!ready) reject(new Error('Server startup timeout'));
        });
      }
    }, 30000);
  });
}

async function takeScreenshot() {
  return new Promise((resolve, reject) => {
    http
      .get(`${BASE_URL}`, (res) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${captureDir}/app-${timestamp}.html`;
        const file = fs.createWriteStream(filename);

        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Screenshot saved: ${filename}`);
          resolve(filename);
        });
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

async function executeCommand(input) {
  const [cmd, ...args] = input.trim().split(/\s+/);

  switch (cmd.toLowerCase()) {
    case 'launch':
      console.log('Launching dev server...');
      await launchServer();
      await waitForServer();
      break;

    case 'ss':
    case 'screenshot':
      await takeScreenshot();
      break;

    case 'url':
      console.log(`Base URL: ${BASE_URL}`);
      break;

    case 'status':
      const ready = await checkServerReady();
      console.log(`Server status: ${ready ? 'READY' : 'NOT READY'}`);
      break;

    case 'help':
    case '?':
      console.log(`
Available commands:
  launch       - Start the dev server
  ss           - Take a screenshot (HTML capture)
  url          - Print the base URL
  status       - Check server status
  quit         - Exit the driver
  help         - Show this message
      `);
      break;

    case 'quit':
    case 'exit':
      if (devProcess) {
        devProcess.kill();
      }
      process.exit(0);
      break;

    default:
      console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Gestion de Vacaciones - Dev Driver                           ║
║  Type 'help' for available commands                           ║
╚════════════════════════════════════════════════════════════════╝
  `);

  // Auto-launch server
  try {
    console.log('Auto-launching dev server...');
    await launchServer();
    if (await waitForServer()) {
      console.log('Type commands (launch, ss, url, status, help, quit)');
    }
  } catch (err) {
    console.error('Failed to auto-launch:', err.message);
  }

  // REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    if (line.trim()) {
      try {
        await executeCommand(line);
      } catch (err) {
        console.error('Error:', err.message);
      }
    }
    rl.prompt();
  });

  rl.on('close', () => {
    if (devProcess) {
      devProcess.kill();
    }
    process.exit(0);
  });
}

// Handle termination
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (devProcess) {
    devProcess.kill();
  }
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
