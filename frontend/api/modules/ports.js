import net from 'net';
import https from 'https';
import http from 'http';

const TOP_PORTS = [
  { port: 21,    service: 'FTP' },
  { port: 22,    service: 'SSH' },
  { port: 23,    service: 'Telnet' },
  { port: 25,    service: 'SMTP' },
  { port: 53,    service: 'DNS' },
  { port: 80,    service: 'HTTP' },
  { port: 110,   service: 'POP3' },
  { port: 143,   service: 'IMAP' },
  { port: 443,   service: 'HTTPS' },
  { port: 445,   service: 'SMB' },
  { port: 587,   service: 'SMTP/TLS' },
  { port: 993,   service: 'IMAPS' },
  { port: 995,   service: 'POP3S' },
  { port: 1433,  service: 'MSSQL' },
  { port: 2222,  service: 'SSH-alt' },
  { port: 3000,  service: 'Dev/Node' },
  { port: 3306,  service: 'MySQL' },
  { port: 3389,  service: 'RDP' },
  { port: 4443,  service: 'HTTPS-alt' },
  { port: 5432,  service: 'PostgreSQL' },
  { port: 5900,  service: 'VNC' },
  { port: 6379,  service: 'Redis' },
  { port: 8080,  service: 'HTTP-alt' },
  { port: 8443,  service: 'HTTPS-alt' },
  { port: 8888,  service: 'HTTP-alt' },
  { port: 9200,  service: 'Elasticsearch' },
  { port: 27017, service: 'MongoDB' }
];

const RISKY_PORTS = [21, 23, 445, 1433, 3306, 3389, 5432, 5900, 6379, 9200, 27017];
const HTTP_PORTS  = [80, 8080, 8888, 3000];
const HTTPS_PORTS = [443, 8443, 4443];

const PORT_TIMEOUT = process.env.VERCEL ? 1200 : 2500;

function probePort(host, port, timeout = PORT_TIMEOUT) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let banner = '';
    let resolved = false;

    const done = (open) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ port, open, banner: banner.slice(0, 300).trim() });
    };

    socket.setTimeout(timeout);
    socket.on('connect', () => { setTimeout(() => done(true), 500); });
    socket.on('data', (d) => { banner += d.toString('utf8', 0, 300); });
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
    socket.connect(port, host);
  });
}

function probeHTTPHeaders(host, port) {
  const useHTTPS = HTTPS_PORTS.includes(port);
  const mod = useHTTPS ? https : http;
  const url = `${useHTTPS ? 'https' : 'http'}://${host}:${port}/`;

  return new Promise((resolve) => {
    const req = mod.request(url, { method: 'HEAD', timeout: 3000, rejectUnauthorized: false }, (res) => {
      resolve({
        status: res.statusCode,
        server: res.headers['server'] || null,
        poweredBy: res.headers['x-powered-by'] || null,
        via: res.headers['via'] || null,
        contentType: res.headers['content-type'] || null
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function detectService(port, banner) {
  const b = banner.toLowerCase();

  // SSH — "SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6"
  if (b.startsWith('ssh-') || b.includes('ssh-2.0') || b.includes('ssh-1.')) {
    const match = banner.match(/SSH-[\d.]+-([^\r\n]+)/i);
    const version = match?.[1]?.trim() || null;
    const software = version?.split(/[\s_]/)[0] || 'SSH';
    return { name: 'SSH', software, version };
  }

  // FTP — "220 ProFTPD 1.3.5 Server"
  if (b.includes('ftp') || (b.startsWith('220') && !b.includes('smtp'))) {
    const match = banner.match(/220[- ](.{1,80})/);
    const raw = match?.[1]?.trim() || '';
    const verMatch = raw.match(/(\d+\.\d+[\.\d]*)/);
    return { name: 'FTP', software: raw.split(' ')[0] || 'FTP', version: verMatch?.[1] || null };
  }

  // SMTP — "220 mail.example.com ESMTP Postfix"
  if (b.includes('esmtp') || b.includes('smtp') || (b.startsWith('220') && b.includes('mail'))) {
    const match = banner.match(/220[- ](.{1,80})/);
    const raw = match?.[1]?.trim() || '';
    const softwareMatch = raw.match(/ESMTP\s+(\S+)/i);
    return { name: 'SMTP', software: softwareMatch?.[1] || 'SMTP', version: null };
  }

  // Redis — INFO reply contains "redis_version:7.0.11"
  if (b.includes('redis_version') || b.includes('-err') || b.includes('redis')) {
    const match = banner.match(/redis_version:([^\r\n]+)/i);
    return { name: 'Redis', software: 'Redis', version: match?.[1]?.trim() || null };
  }

  // MongoDB — binary protocol, check for common bytes or ISMASTER
  if (b.includes('mongodb') || b.includes('ismaster') || b.includes('version')) {
    const match = banner.match(/"version"\s*:\s*"([^"]+)"/);
    return { name: 'MongoDB', software: 'MongoDB', version: match?.[1] || null };
  }

  // MySQL/MariaDB — first bytes contain version string
  if (b.includes('mysql') || b.includes('mariadb') || banner.match(/[\x00-\x08]\d+\.\d+\.\d+/)) {
    const verMatch = banner.match(/(\d+\.\d+\.\d+[^\s\x00]*)/);
    const isMariaDB = b.includes('mariadb');
    return { name: isMariaDB ? 'MariaDB' : 'MySQL', software: isMariaDB ? 'MariaDB' : 'MySQL', version: verMatch?.[1] || null };
  }

  // PostgreSQL — sends auth request, not a readable banner usually
  if (b.includes('postgresql') || b.includes('pg_hba')) {
    return { name: 'PostgreSQL', software: 'PostgreSQL', version: null };
  }

  // Elasticsearch — HTTP JSON response
  if (b.includes('elasticsearch') || b.includes('"number"')) {
    const match = banner.match(/"number"\s*:\s*"([^"]+)"/);
    return { name: 'Elasticsearch', software: 'Elasticsearch', version: match?.[1] || null };
  }

  // Telnet
  if (port === 23 || b.includes('\xff\xfd') || b.includes('telnet')) {
    return { name: 'Telnet', software: 'Telnet', version: null };
  }

  const known = TOP_PORTS.find(p => p.port === port);
  return { name: known?.service || 'Unknown', software: null, version: null };
}

function parseHTTPService(port, httpInfo) {
  if (!httpInfo) return null;
  const server = httpInfo.server || '';
  const poweredBy = httpInfo.poweredBy || '';

  // Parse "nginx/1.18.0", "Apache/2.4.41 (Ubuntu)", "cloudflare"
  const serverMatch = server.match(/^([^\/\s]+)(?:\/([^\s(]+))?/);
  const software = serverMatch?.[1] || server || null;
  const version = serverMatch?.[2] || null;

  const isHTTPS = HTTPS_PORTS.includes(port);
  return {
    name: isHTTPS ? 'HTTPS' : 'HTTP',
    software: software || (isHTTPS ? 'HTTPS' : 'HTTP'),
    version,
    poweredBy: poweredBy || null,
    httpStatus: httpInfo.status
  };
}

export async function runPorts(host) {
  const results = [];
  const batchSize = 10;

  for (let i = 0; i < TOP_PORTS.length; i += batchSize) {
    const batch = TOP_PORTS.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(({ port }) => probePort(host, port)));
    results.push(...batchResults);
  }

  const openRaw = results.filter(r => r.open);

  // Probe HTTP/HTTPS headers in parallel for web ports
  const httpProbes = {};
  await Promise.all(
    openRaw
      .filter(r => [...HTTP_PORTS, ...HTTPS_PORTS].includes(r.port))
      .map(async r => {
        httpProbes[r.port] = await probeHTTPHeaders(host, r.port);
      })
  );

  const open = openRaw.map(r => {
    const isWebPort = [...HTTP_PORTS, ...HTTPS_PORTS].includes(r.port);
    const httpInfo = httpProbes[r.port];

    let svc;
    if (isWebPort && httpInfo) {
      svc = parseHTTPService(r.port, httpInfo);
    } else {
      svc = detectService(r.port, r.banner);
    }

    return {
      port: r.port,
      service: svc.name,
      software: svc.software,
      version: svc.version || null,
      poweredBy: svc.poweredBy || null,
      httpStatus: svc.httpStatus || null,
      banner: r.banner || null,
      risky: RISKY_PORTS.includes(r.port)
    };
  });

  const findings = generatePortFindings(open);
  return { open, total: TOP_PORTS.length, findings };
}

function generatePortFindings(openPorts) {
  const findings = [];

  const telnet = openPorts.find(p => p.port === 23);
  if (telnet) findings.push({ severity: 'critical', title: 'Telnet Open (port 23)', detail: 'Telnet transmits credentials in plaintext', remediation: 'Disable Telnet, use SSH instead' });

  const rdp = openPorts.find(p => p.port === 3389);
  if (rdp) findings.push({ severity: 'high', title: 'RDP Exposed (port 3389)', detail: 'RDP directly exposed — bruteforce and BlueKeep attack surface', remediation: 'Restrict RDP behind VPN, enable NLA, block public access' });

  const smb = openPorts.find(p => p.port === 445);
  if (smb) findings.push({ severity: 'high', title: 'SMB Exposed (port 445)', detail: 'SMB exposed publicly — EternalBlue/ransomware attack surface', remediation: 'Block port 445 at firewall, never expose SMB publicly' });

  const databases = openPorts.filter(p => [3306, 5432, 1433, 27017, 6379, 9200].includes(p.port));
  databases.forEach(db => {
    findings.push({ severity: 'critical', title: `Database Exposed: ${db.software || db.service}${db.version ? ' ' + db.version : ''} (port ${db.port})`, detail: `${db.service} publicly accessible — direct database access possible`, remediation: 'Bind to localhost only, use firewall rules, never expose databases publicly' });
  });

  const vnc = openPorts.find(p => p.port === 5900);
  if (vnc) findings.push({ severity: 'high', title: 'VNC Exposed (port 5900)', detail: 'VNC desktop access exposed publicly', remediation: 'Restrict VNC to localhost, use SSH tunnel' });

  const ssh = openPorts.find(p => p.port === 22);
  if (ssh) findings.push({ severity: 'info', title: `SSH Open (port 22)${ssh.version ? ' — ' + ssh.version : ''}`, detail: `SSH accessible: ${ssh.version || ssh.banner || 'no banner'}`, remediation: 'Ensure key-only auth, disable root login, consider port knocking' });

  const ftp = openPorts.find(p => p.port === 21);
  if (ftp) findings.push({ severity: 'medium', title: `FTP Open (port 21)${ftp.version ? ' — ' + ftp.version : ''}`, detail: 'FTP transmits credentials in plaintext', remediation: 'Replace with SFTP or FTPS' });

  // Flag outdated software versions
  openPorts.forEach(p => {
    if (p.software === 'OpenSSH' && p.version) {
      const ver = parseFloat(p.version);
      if (ver < 8.0) findings.push({ severity: 'medium', title: `Outdated OpenSSH ${p.version}`, detail: 'OpenSSH < 8.0 has known vulnerabilities', remediation: 'Upgrade to OpenSSH 9.x' });
    }
    if ((p.software === 'nginx' || p.software === 'Apache') && p.version) {
      findings.push({ severity: 'info', title: `Web server version disclosed: ${p.software}/${p.version}`, detail: 'Server version exposed — enables targeted CVE search', remediation: 'Set server_tokens off (nginx) or ServerTokens Prod (Apache)' });
    }
  });

  return findings;
}
